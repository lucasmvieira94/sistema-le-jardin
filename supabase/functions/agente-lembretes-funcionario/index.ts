// Edge function: agente-lembretes-funcionario
// Detecta pendências do funcionário (ponto, prontuários, medicamentos)
// e gera lembretes contextualizados via Lovable AI Gateway.
// Suporta dois modos:
//   1) action=detectar -> retorna JSON com pendências + mensagens curtas geradas pela IA
//   2) action=chat -> stream SSE de chat conversacional sobre as pendências

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TZ = "America/Sao_Paulo";

function hojeBR(): string {
  // YYYY-MM-DD em São Paulo
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
}

function horaAtualBR(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

type Pendencia = {
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  referencia_id?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Coleta todas as pendências relevantes do funcionário no dia atual.
 */
async function coletarPendencias(
  supabase: any,
  funcionarioId: string
): Promise<{ funcionario: any; pendencias: Pendencia[] }> {
  const hoje = hojeBR();
  const horaAgora = horaAtualBR();
  const pendencias: Pendencia[] = [];

  // 1) Buscar funcionário e escala
  const { data: funcionario } = await supabase
    .from("funcionarios")
    .select("id, nome_completo, registra_ponto, escala_id, escalas(entrada, saida, intervalo_inicio, intervalo_fim, nome)")
    .eq("id", funcionarioId)
    .maybeSingle();

  if (!funcionario) {
    return { funcionario: null, pendencias: [] };
  }

  // 2) Pendências de PONTO (apenas se registra ponto e tem escala)
  if (funcionario.registra_ponto && funcionario.escalas) {
    const escala = funcionario.escalas as any;

    // Buscar registro de hoje
    const { data: regHoje } = await supabase
      .from("registros_ponto")
      .select("entrada, intervalo_inicio, intervalo_fim, saida")
      .eq("funcionario_id", funcionarioId)
      .eq("data", hoje)
      .maybeSingle();

    const { data: regOntem } = await supabase
      .from("registros_ponto")
      .select("entrada, intervalo_inicio, intervalo_fim, saida, data")
      .eq("funcionario_id", funcionarioId)
      .lt("data", hoje)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    const registro = regHoje || (regOntem && !regOntem.saida ? regOntem : null);

    const horaParaMin = (h: string) => {
      const [hh, mm] = h.split(":").map(Number);
      return hh * 60 + mm;
    };
    const agoraMin = horaParaMin(horaAgora);

    if (escala.entrada) {
      const entradaMin = horaParaMin(escala.entrada);
      // Sugerir lembrete de entrada se está perto/passou do horário e não bateu entrada
      if (!registro?.entrada && agoraMin >= entradaMin - 30) {
        pendencias.push({
          tipo: "ponto_entrada",
          titulo: "Registrar ponto de entrada",
          descricao: `Sua entrada está prevista para ${escala.entrada.slice(0, 5)}. Não esqueça de bater o ponto.`,
          prioridade: agoraMin > entradaMin + 10 ? "alta" : "media",
          metadata: { horario_previsto: escala.entrada },
        });
      }
    }

    if (registro?.entrada && escala.intervalo_inicio && !registro.intervalo_inicio) {
      const intMin = horaParaMin(escala.intervalo_inicio);
      if (agoraMin >= intMin - 15) {
        pendencias.push({
          tipo: "ponto_intervalo_inicio",
          titulo: "Iniciar intervalo",
          descricao: `Hora de iniciar seu intervalo (previsto ${escala.intervalo_inicio.slice(0, 5)}).`,
          prioridade: "media",
        });
      }
    }

    if (registro?.intervalo_inicio && escala.intervalo_fim && !registro.intervalo_fim) {
      const intFimMin = horaParaMin(escala.intervalo_fim);
      if (agoraMin >= intFimMin - 5) {
        pendencias.push({
          tipo: "ponto_intervalo_fim",
          titulo: "Encerrar intervalo",
          descricao: `Retorno do intervalo previsto para ${escala.intervalo_fim.slice(0, 5)}.`,
          prioridade: "media",
        });
      }
    }

    if (registro?.entrada && !registro.saida && escala.saida) {
      const saidaMin = horaParaMin(escala.saida);
      if (agoraMin >= saidaMin - 15) {
        pendencias.push({
          tipo: "ponto_saida",
          titulo: "Registrar saída",
          descricao: `Sua saída está prevista para ${escala.saida.slice(0, 5)}. Bater ponto antes de sair.`,
          prioridade: agoraMin > saidaMin + 30 ? "alta" : "media",
          metadata: { horario_previsto: escala.saida },
        });
      }
    }
  }

  // 3) Pendências de PRONTUÁRIO (ciclos do dia em aberto)
  const { data: ciclos } = await supabase
    .from("prontuario_ciclos")
    .select("id, status, residente_id, residentes(nome_completo)")
    .eq("data_ciclo", hoje)
    .in("status", ["nao_iniciado", "em_andamento"])
    .limit(20);

  if (ciclos && ciclos.length > 0) {
    const naoIniciados = ciclos.filter((c: any) => c.status === "nao_iniciado");
    const emAndamento = ciclos.filter((c: any) => c.status === "em_andamento");

    if (naoIniciados.length > 0) {
      pendencias.push({
        tipo: "prontuario_pendente",
        titulo: `${naoIniciados.length} prontuário(s) não iniciado(s)`,
        descricao: `Residentes aguardando registros: ${naoIniciados
          .slice(0, 5)
          .map((c: any) => c.residentes?.nome_completo || "—")
          .join(", ")}${naoIniciados.length > 5 ? "..." : ""}`,
        prioridade: "alta",
        metadata: {
          quantidade: naoIniciados.length,
          residentes: naoIniciados.map((c: any) => c.residentes?.nome_completo).filter(Boolean),
        },
      });
    }
    if (emAndamento.length > 0) {
      pendencias.push({
        tipo: "prontuario_em_andamento",
        titulo: `${emAndamento.length} prontuário(s) em andamento`,
        descricao: `Conclua os registros de: ${emAndamento
          .slice(0, 5)
          .map((c: any) => c.residentes?.nome_completo || "—")
          .join(", ")}`,
        prioridade: "media",
        metadata: { quantidade: emAndamento.length },
      });
    }
  }

  // 4) Pendências de MEDICAMENTOS (próximas 2h)
  const { data: prescricoes } = await supabase
    .from("prescricoes_medicamentos")
    .select("id, horarios, dosagem, medicamento:medicamentos(nome), residente:residentes(id, nome_completo)")
    .eq("ativo", true);

  const { data: administracoesHoje } = await supabase
    .from("administracao_medicamentos")
    .select("medicamento_id, residente_id, horario_administracao")
    .eq("data_administracao", hoje);

  if (prescricoes) {
    const agoraMinTotal = horaParaMinUtil(horaAgora);
    const horariosProximos: any[] = [];

    for (const p of prescricoes as any[]) {
      if (!p.horarios || !Array.isArray(p.horarios)) continue;
      for (const h of p.horarios) {
        const hMin = horaParaMinUtil(h);
        const diff = hMin - agoraMinTotal;
        // Janela: do passado recente (-15min) até próximas 2h
        if (diff >= -15 && diff <= 120) {
          // Verifica se já foi administrado
          const jaAdm = administracoesHoje?.some(
            (a: any) =>
              a.medicamento_id === p.medicamento?.id &&
              a.residente_id === p.residente?.id &&
              a.horario_administracao?.slice(0, 5) === h.slice(0, 5)
          );
          if (!jaAdm) {
            horariosProximos.push({
              hora: h.slice(0, 5),
              medicamento: p.medicamento?.nome,
              dosagem: p.dosagem,
              residente: p.residente?.nome_completo,
              prescricao_id: p.id,
              atrasado: diff < 0,
            });
          }
        }
      }
    }

    if (horariosProximos.length > 0) {
      const atrasados = horariosProximos.filter((h) => h.atrasado);
      pendencias.push({
        tipo: "medicamento_horario",
        titulo:
          atrasados.length > 0
            ? `${atrasados.length} medicamento(s) atrasado(s)`
            : `${horariosProximos.length} medicamento(s) nas próximas 2h`,
        descricao: horariosProximos
          .slice(0, 4)
          .map((h) => `${h.hora} • ${h.medicamento} (${h.dosagem}) - ${h.residente}`)
          .join("\n"),
        prioridade: atrasados.length > 0 ? "alta" : "media",
        metadata: { horarios: horariosProximos },
      });
    }
  }

  return { funcionario, pendencias };
}

function horaParaMinUtil(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

/**
 * Gera mensagem amigável e personalizada via Lovable AI a partir das pendências.
 */
async function gerarMensagemIA(funcionarioNome: string, pendencias: Pendencia[]): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return "";
  }
  if (pendencias.length === 0) {
    return "";
  }

  const systemPrompt = `Você é um agente de IA de produtividade chamado "Lembrete IA" para cuidadores de uma instituição de longa permanência. 
Sua função é lembrar com gentileza e foco prático sobre as rotinas pendentes.
Estilo: PT-BR, curto (máx 2 frases), tom acolhedor, direto, sem repetir lista de pendências (elas já são exibidas em cards).
Use o primeiro nome do funcionário e priorize o que é mais urgente.`;

  const userPrompt = `Funcionário: ${funcionarioNome}
Hora atual: ${horaAtualBR()} (Brasília)

Pendências detectadas (ordenadas):
${pendencias.map((p, i) => `${i + 1}. [${p.prioridade.toUpperCase()}] ${p.titulo} — ${p.descricao}`).join("\n")}

Gere UMA mensagem motivacional curta (1 a 2 frases) destacando o que é mais importante agora.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!resp.ok) {
      console.error("AI gateway error:", resp.status, await resp.text());
      return "";
    }
    const json = await resp.json();
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    console.error("Erro ao gerar mensagem IA:", e);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "detectar";
    const funcionarioId = body.funcionario_id;

    if (!funcionarioId) {
      return new Response(JSON.stringify({ error: "funcionario_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === MODO 1: detectar pendências (JSON) ===
    if (action === "detectar") {
      const { funcionario, pendencias } = await coletarPendencias(supabase, funcionarioId);
      if (!funcionario) {
        return new Response(JSON.stringify({ error: "funcionario não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mensagemIA = await gerarMensagemIA(funcionario.nome_completo, pendencias);

      return new Response(
        JSON.stringify({
          funcionario_nome: funcionario.nome_completo,
          hora: horaAtualBR(),
          mensagem_ia: mensagemIA,
          pendencias,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MODO 2: chat conversacional (SSE stream) ===
    if (action === "chat") {
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const messages = body.messages ?? [];
      const { funcionario, pendencias } = await coletarPendencias(supabase, funcionarioId);

      const contextoPendencias =
        pendencias.length > 0
          ? pendencias
              .map(
                (p) =>
                  `- [${p.prioridade.toUpperCase()}] ${p.titulo}: ${p.descricao}`
              )
              .join("\n")
          : "Nenhuma pendência relevante no momento.";

      const systemPrompt = `Você é o "Lembrete IA", um assistente conversacional para cuidadores em instituição de longa permanência.
Funcionário: ${funcionario?.nome_completo ?? "—"}
Hora atual (Brasília): ${horaAtualBR()}

ROTINAS QUE VOCÊ MONITORA:
- Registro de ponto (entrada, intervalos, saída) conforme escala
- Preenchimento dos prontuários dos residentes
- Administração de medicamentos prescritos

SITUAÇÃO ATUAL DO FUNCIONÁRIO:
${contextoPendencias}

REGRAS:
- Responda em PT-BR, tom acolhedor, prático e direto.
- Foque em ajudar o funcionário a organizar a rotina e priorizar o que é urgente.
- Quando perguntarem "o que falta fazer?" ou similar, liste de forma clara as pendências.
- Não invente dados; use apenas o que está no contexto.
- Respostas curtas (máx 4 linhas) salvo se o funcionário pedir detalhes.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos esgotados na IA." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        return new Response(JSON.stringify({ error: "Erro no gateway IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(resp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro agente-lembretes-funcionario:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});