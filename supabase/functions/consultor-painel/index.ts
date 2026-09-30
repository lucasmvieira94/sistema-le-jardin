/**
 * Consultor do painel — agente de IA que analisa o uso do sistema e as
 * pendências operacionais e sugere adicionar, ocultar ou reordenar quadros.
 *
 * Chamado por: administrador (botão "Analisar agora", analisa a própria empresa)
 * ou pelo agendamento semanal (service role, analisa até 20 empresas por execução).
 * Proteções: trava de execução única, pausa persistida em erros 402/403,
 * limite de empresas por execução e deduplicação de sugestões pendentes.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MAX_TENANTS = 20;

const QUADROS: Record<string, string> = {
  ponto: "Monitoramento do ponto (faltas, saídas e intervalos não registrados, folhas não confirmadas)",
  prontuarios_pendencias: "Pendências do prontuário do dia",
  medicamentos: "Alertas de estoque de medicamentos",
  prontuarios_hoje: "Resumo dos prontuários de hoje",
  registros_hoje: "Registros de ponto de hoje",
  fraldas: "Estoque de fraldas",
  escalas: "Alertas de escalas",
  contas_pagar: "Contas a pagar próximas",
  contratos: "Contratos de residentes a renovar",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sugestoes"],
  properties: {
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "quadro", "posicao", "motivo"],
        properties: {
          tipo: { type: "string", enum: ["adicionar", "remover", "reordenar"] },
          quadro: { type: "string" },
          posicao: { type: ["integer", "null"] },
          motivo: { type: "string" },
        },
      },
    },
  },
};

class GatewayError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

/** Chama a IA com streaming (Responses API) e devolve o texto final. */
async function perguntarIA(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "sugestoes_painel", strict: true, schema: SCHEMA } },
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    let msg = t;
    try { msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || t; } catch { /* texto puro */ }
    throw new GatewayError(resp.status, msg || `Erro ${resp.status} na IA`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "", texto = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) !== -1) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linha.startsWith("data:")) continue;
      const dado = linha.slice(5).trim();
      if (!dado || dado === "[DONE]") continue;
      try {
        const ev = JSON.parse(dado);
        if (ev.type === "response.output_text.delta") texto += ev.delta ?? "";
        if (ev.type === "response.refusal.delta" || ev.type === "error" || ev.type === "response.failed") {
          throw new GatewayError(403, ev?.error?.message || "A IA recusou a solicitação");
        }
      } catch (e) {
        if (e instanceof GatewayError) throw e;
      }
    }
  }
  if (!texto.trim()) throw new GatewayError(403, "A IA não retornou resposta");
  return texto;
}

async function analisarTenant(db: any, apiKey: string, tenantId: string | null) {
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const seteDias = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const porTenant = (q: any) => (tenantId ? q.eq("tenant_id", tenantId) : q.is("tenant_id", null));

  const { data: eventos } = await porTenant(db.from("uso_sistema_eventos").select("tipo, alvo, user_id").gte("created_at", desde)).limit(20000);
  const uso: Record<string, number> = {};
  const usuarios = new Set<string>();
  for (const e of eventos || []) {
    uso[`${e.tipo}:${e.alvo}`] = (uso[`${e.tipo}:${e.alvo}`] || 0) + 1;
    usuarios.add(e.user_id);
  }

  const contar = async (q: any) => { const { count } = await q; return count ?? 0; };
  const [saidasAbertas, justifPendentes, intercAbertas] = await Promise.all([
    contar(porTenant(db.from("registros_ponto").select("id", { count: "exact", head: true }).is("saida", null).gte("data", seteDias).lt("data", hoje))),
    contar(porTenant(db.from("justificativas_atraso").select("id", { count: "exact", head: true }).eq("status", "pendente"))),
    contar(porTenant(db.from("intercorrencias").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_analise", "em_andamento"]))),
  ]);

  const { data: prefs } = await porTenant(db.from("dashboard_preferencias").select("ordem, ocultos"));
  const { data: recentes } = await porTenant(db.from("dashboard_sugestoes_ia").select("tipo, quadro, status").gte("created_at", desde));

  const prompt = `Você é consultor de usabilidade de um sistema de gestão de residencial sênior (ILPI).
Analise os últimos 30 dias e sugira de 0 a 4 ajustes no painel principal da gestão.
Regras:
- Use apenas estes ids de quadro: ${Object.keys(QUADROS).join(", ")}.
- "remover" = ocultar quadro pouco visto/clicado e sem pendências relevantes.
- "adicionar" = voltar a mostrar quadro oculto quando há pendências relacionadas; use posicao (0 = topo) ou null.
- "reordenar" = mover para posicao (0 = topo) um quadro muito usado ou com muitas pendências.
- Não repita sugestões já dispensadas ou pendentes. Se o uso for insuficiente (poucos eventos), retorne lista vazia.
- motivo: 1 frase em português, até 200 caracteres, citando números concretos.

Quadros: ${JSON.stringify(QUADROS)}
Uso (tipo:alvo -> eventos, ${usuarios.size} usuários): ${JSON.stringify(uso)}
Pendências: saídas de ponto não registradas nos últimos 7 dias=${saidasAbertas}; justificativas de atraso aguardando análise=${justifPendentes}; intercorrências abertas=${intercAbertas}
Preferências atuais dos usuários: ${JSON.stringify(prefs || [])}
Sugestões recentes e decisões: ${JSON.stringify(recentes || [])}`;

  const bruto = await perguntarIA(apiKey, prompt);
  let lista: any[] = [];
  try { lista = JSON.parse(bruto).sugestoes || []; } catch { lista = []; }

  const pendentes = new Set((recentes || []).filter((r: any) => r.status !== "aplicada").map((r: any) => `${r.tipo}|${r.quadro}`));
  const novas = lista
    .filter((s) => QUADROS[s.quadro] && ["adicionar", "remover", "reordenar"].includes(s.tipo) && !pendentes.has(`${s.tipo}|${s.quadro}`))
    .slice(0, 4)
    .map((s) => ({
      tenant_id: tenantId, tipo: s.tipo, quadro: s.quadro,
      posicao: Number.isInteger(s.posicao) ? Math.max(0, Math.min(20, s.posicao)) : null,
      motivo: String(s.motivo || "").slice(0, 300) || "Sugestão baseada no uso recente.",
    }));
  if (novas.length) {
    const { error } = await db.from("dashboard_sugestoes_ia").insert(novas);
    if (error) throw new Error(`Falha ao salvar sugestões: ${error.message}`);
  }
  return novas.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Chave da IA não configurada" }, 500);
  const db = createClient(url, serviceKey);

  // Identifica o chamador
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return json({ error: "Não autorizado" }, 401);
  let tenants: (string | null)[] = [];
  let manual = false;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  // O agendamento semanal usa a chave pública; só roda se a última execução tiver mais de 6 dias.
  const agendado = token === serviceKey || (!!anonKey && token === anonKey);
  if (agendado && token !== serviceKey) {
    const { data: est } = await db.from("consultor_painel_execucoes").select("ultima_execucao").eq("chave", "global").maybeSingle();
    if (est?.ultima_execucao && Date.now() - new Date(est.ultima_execucao).getTime() < 6 * 86_400_000) {
      return json({ ignorado: "Análise semanal já realizada" });
    }
  }
  if (agendado) {
    const { data } = await db.from("uso_sistema_eventos").select("tenant_id")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(5000);
    tenants = [...new Set((data || []).map((d: any) => d.tenant_id))].slice(0, MAX_TENANTS);
  } else {
    const { data: u, error } = await db.auth.getUser(token);
    if (error || !u.user) return json({ error: "Não autorizado" }, 401);
    const { data: roles } = await db.from("user_roles").select("role, tenant_id").eq("user_id", u.user.id);
    const admin = (roles || []).find((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!admin) return json({ error: "Somente administradores podem analisar o painel" }, 403);
    tenants = [admin.tenant_id ?? null];
    manual = true;
  }

  // Pausa persistida (créditos/política) e trava de execução única
  const chave = "global";
  const { data: estado } = await db.from("consultor_painel_execucoes").select("*").eq("chave", chave).maybeSingle();
  if (estado?.pausado_motivo && !manual) return json({ pausado: estado.pausado_motivo });
  if (estado?.trava_ate && new Date(estado.trava_ate) > new Date()) return json({ error: "Uma análise já está em andamento. Tente em alguns minutos." }, 409);
  await db.from("consultor_painel_execucoes").upsert({ chave, trava_ate: new Date(Date.now() + 5 * 60_000).toISOString(), updated_at: new Date().toISOString() });

  let total = 0;
  try {
    for (const t of tenants) total += await analisarTenant(db, apiKey, t);
    await db.from("consultor_painel_execucoes").update({ trava_ate: null, pausado_motivo: null, ultima_execucao: new Date().toISOString() }).eq("chave", chave);
    return json({ sugestoes: total, empresas: tenants.length });
  } catch (e) {
    const status = e instanceof GatewayError ? e.status : 500;
    const motivo = e instanceof Error ? e.message : String(e);
    const pausar = status === 402 || status === 403;
    await db.from("consultor_painel_execucoes").update({ trava_ate: null, pausado_motivo: pausar ? motivo : null }).eq("chave", chave);
    console.error("[consultor-painel]", status, motivo);
    const msg = status === 402 ? "Créditos de IA insuficientes. Adicione créditos para continuar."
      : status === 429 ? "Muitas solicitações à IA agora. Tente novamente mais tarde."
      : motivo;
    return json({ error: msg }, status === 402 || status === 403 || status === 429 ? status : 500);
  }
});
