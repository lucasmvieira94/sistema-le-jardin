/**
 * Canal de Denúncias — back-office do comitê (papel "compliance").
 * Administradores gerais NÃO leem denúncias; podem apenas designar o comitê (action equipe_*).
 * Toda leitura/alteração gera registro na trilha imutável `denuncias_auditoria`.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { b64, cifrarTexto, decifrarBytes, decifrarTexto } from "../_shared/denunciaCripto.ts";

const SITUACOES = ["recebida", "em_analise", "em_apuracao", "aguardando_informacoes", "concluida", "arquivada"] as const;
const Corpo = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listar") }),
  z.object({ action: z.literal("detalhe"), id: z.string().uuid() }),
  z.object({ action: z.literal("anexo"), id: z.string().uuid() }),
  z.object({
    action: z.literal("atualizar"), id: z.string().uuid(),
    situacao: z.enum(SITUACOES).optional(),
    conclusao: z.enum(["procedente", "improcedente", "inconclusiva"]).nullable().optional(),
    probabilidade: z.number().int().min(1).max(5).nullable().optional(),
    severidade: z.number().int().min(1).max(5).nullable().optional(),
    medidas: z.string().max(4000).optional(),
  }),
  z.object({ action: z.literal("mensagem"), id: z.string().uuid(), texto: z.string().trim().min(1).max(4000), interna: z.boolean() }),
  z.object({ action: z.literal("equipe_listar") }),
  z.object({ action: z.literal("equipe_adicionar"), email: z.string().trim().email().max(255) }),
  z.object({ action: z.literal("equipe_remover"), user_id: z.string().uuid() }),
  z.object({ action: z.literal("sou_comite") }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Não autorizado" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: u } = await admin.auth.getUser(token);
    const user = u.user;
    if (!user) return json({ error: "Não autorizado" }, 401);

    const p = Corpo.safeParse(await req.json());
    if (!p.success) return json({ error: "Dados inválidos" }, 400);
    const b = p.data;

    const { data: papeis } = await admin.from("user_roles").select("role, tenant_id").eq("user_id", user.id);
    const roles = (papeis ?? []).map((r) => String(r.role));
    const ehComite = roles.includes("compliance");
    const ehAdmin = roles.includes("admin") || roles.includes("super_admin");

    if (b.action === "sou_comite") return json({ comite: ehComite });

    // --- Designação do comitê (somente administradores; não dá acesso ao conteúdo) ---
    if (b.action.startsWith("equipe_")) {
      if (!ehAdmin) return json({ error: "Apenas administradores designam o comitê" }, 403);
      const tenantId = (papeis ?? []).find((r) => r.tenant_id)?.tenant_id ?? null;
      if (b.action === "equipe_adicionar") {
        let alvo: string | null = null;
        for (let page = 1; page <= 10 && !alvo; page++) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          alvo = data.users.find((x) => x.email?.toLowerCase() === b.email.toLowerCase())?.id ?? null;
          if (data.users.length < 200) break;
        }
        if (!alvo) return json({ error: "Nenhum usuário do sistema com esse e-mail" }, 404);
        const { error } = await admin.from("user_roles").insert({ user_id: alvo, role: "compliance", tenant_id: tenantId });
        if (error) return json({ error: error.message.includes("Máximo") ? "Máximo de 2 pessoas no comitê" : "Não foi possível designar" }, 400);
        await admin.from("denuncias_auditoria").insert({ usuario_id: user.id, usuario_nome: user.email, acao: "comite_designado", detalhe: `Designou ${b.email} ao comitê` });
      }
      if (b.action === "equipe_remover") {
        await admin.from("user_roles").delete().eq("user_id", b.user_id).eq("role", "compliance");
        await admin.from("denuncias_auditoria").insert({ usuario_id: user.id, usuario_nome: user.email, acao: "comite_removido", detalhe: `Removeu ${b.user_id} do comitê` });
      }
      const { data: equipe } = await admin.from("user_roles").select("user_id").eq("role", "compliance");
      const lista = [];
      for (const e of equipe ?? []) {
        const { data } = await admin.auth.admin.getUserById(e.user_id);
        lista.push({ user_id: e.user_id, email: data.user?.email ?? "—" });
      }
      return json({ equipe: lista });
    }

    if (!ehComite) return json({ error: "Acesso restrito ao comitê de apuração" }, 403);
    const auditar = (denuncia_id: string | null, protocolo: string | null, acao: string, detalhe: string) =>
      admin.from("denuncias_auditoria").insert({ denuncia_id, protocolo, usuario_id: user.id, usuario_nome: user.email, acao, detalhe });

    if (b.action === "listar") {
      const { data } = await admin.from("denuncias")
        .select("id, protocolo, anonima, categoria, situacao, conclusao, probabilidade, severidade, prazo_resposta, ainda_ocorre, created_at, updated_at")
        .order("created_at", { ascending: false }).limit(1000);
      await auditar(null, null, "listou", "Abriu a lista de denúncias");
      return json({ denuncias: data ?? [] });
    }

    const { data: d } = await admin.from("denuncias").select("*").eq(b.action === "anexo" ? "id" : "id", b.action === "anexo" ? "00000000-0000-0000-0000-000000000000" : b.id).maybeSingle();

    if (b.action === "anexo") {
      const { data: a } = await admin.from("denuncias_anexos").select("*, denuncias(protocolo)").eq("id", b.id).maybeSingle();
      if (!a) return json({ error: "Anexo não encontrado" }, 404);
      const { data: arq, error } = await admin.storage.from("denuncias-anexos").download(a.path);
      if (error || !arq) return json({ error: "Arquivo indisponível" }, 404);
      const bytes = await decifrarBytes(new Uint8Array(await arq.arrayBuffer()));
      const nome = await decifrarTexto<string>(a.nome_cifrado);
      // deno-lint-ignore no-explicit-any
      await auditar(a.denuncia_id, (a as any).denuncias?.protocolo ?? null, "anexo_visualizado", `Abriu o anexo ${nome}`);
      return json({ nome, mime: a.mime, base64: b64(bytes) });
    }
    if (!d) return json({ error: "Denúncia não encontrada" }, 404);

    if (b.action === "atualizar") {
      const mud: Record<string, unknown> = {};
      const partes: string[] = [];
      if (b.situacao && b.situacao !== d.situacao) { mud.situacao = b.situacao; partes.push(`situação: ${d.situacao} → ${b.situacao}`); }
      if (b.conclusao !== undefined) { mud.conclusao = b.conclusao; partes.push(`conclusão: ${b.conclusao ?? "—"}`); }
      if (b.probabilidade !== undefined) { mud.probabilidade = b.probabilidade; partes.push(`probabilidade ${b.probabilidade ?? "—"}`); }
      if (b.severidade !== undefined) { mud.severidade = b.severidade; partes.push(`severidade ${b.severidade ?? "—"}`); }
      if (b.medidas !== undefined) { mud.medidas_cifradas = await cifrarTexto(b.medidas); partes.push("medidas atualizadas"); }
      if (mud.situacao === "concluida" && !(mud.conclusao ?? d.conclusao)) return json({ error: "Informe a conclusão antes de concluir" }, 400);
      if (Object.keys(mud).length) {
        await admin.from("denuncias").update(mud).eq("id", d.id);
        await auditar(d.id, d.protocolo, "atualizou", partes.join("; "));
      }
    }
    if (b.action === "mensagem") {
      await admin.from("denuncias_mensagens").insert({ denuncia_id: d.id, autor: b.interna ? "interna" : "comite", conteudo_cifrado: await cifrarTexto(b.texto) });
      await auditar(d.id, d.protocolo, b.interna ? "anotacao_interna" : "mensagem_comite", b.interna ? "Registrou anotação interna" : "Enviou mensagem ao denunciante");
    }

    const { data: atual } = await admin.from("denuncias").select("*").eq("id", d.id).single();
    const dados = await decifrarTexto<Record<string, unknown>>(atual.dados_cifrados);
    const medidas = atual.medidas_cifradas ? await decifrarTexto<string>(atual.medidas_cifradas) : "";
    const { data: msgs } = await admin.from("denuncias_mensagens").select("id, autor, conteudo_cifrado, created_at").eq("denuncia_id", d.id).order("created_at");
    const { data: anexos } = await admin.from("denuncias_anexos").select("id, nome_cifrado, mime, tamanho, sha256, enviado_por, created_at").eq("denuncia_id", d.id).order("created_at");
    if (b.action === "detalhe") await auditar(d.id, d.protocolo, "visualizou", "Visualizou a denúncia");
    const { data: trilha } = await admin.from("denuncias_auditoria").select("usuario_nome, acao, detalhe, created_at").eq("denuncia_id", d.id).order("created_at", { ascending: false }).limit(300);
    const { senha_hash: _s, dados_cifrados: _d, medidas_cifradas: _m, ...publico } = atual;
    return json({
      denuncia: { ...publico, ...dados, medidas },
      mensagens: await Promise.all((msgs ?? []).map(async (m) => ({ id: m.id, autor: m.autor, texto: await decifrarTexto<string>(m.conteudo_cifrado), em: m.created_at }))),
      anexos: await Promise.all((anexos ?? []).map(async (a) => ({ id: a.id, nome: await decifrarTexto<string>(a.nome_cifrado), mime: a.mime, tamanho: a.tamanho, sha256: a.sha256, por: a.enviado_por, em: a.created_at }))),
      auditoria: trilha ?? [],
    });
  } catch (_e) {
    console.error("denuncia-comite: falha no processamento");
    return json({ error: "Não foi possível concluir agora." }, 500);
  }
});
