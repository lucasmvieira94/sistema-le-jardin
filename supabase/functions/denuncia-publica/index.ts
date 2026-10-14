/**
 * Canal de Denúncias — rota pública (sem login).
 * PRIVACIDADE: esta função NÃO lê nem grava IP, X-Forwarded-For, User-Agent,
 * cookies ou sessão, e não registra o conteúdo em logs (apenas erros genéricos).
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  cifrarBytes, cifrarTexto, conferirSenha, decifrarTexto, deB64, gerarProtocolo,
  gerarSenha, hashSenha, sha256Hex,
} from "../_shared/denunciaCripto.ts";

const MIMES = /^(application\/pdf|image\/(jpeg|png|webp)|audio\/(mpeg|mp4|ogg|webm|wav|x-m4a|aac))$/;
const Anexo = z.object({
  nome: z.string().min(1).max(150),
  mime: z.string().regex(MIMES),
  base64: z.string().max(14_000_000),
});
const CATEGORIAS = ["assedio_moral", "assedio_sexual", "discriminacao", "sobrecarga", "conflito", "outro"] as const;
const Enviar = z.object({
  action: z.literal("enviar"),
  anonima: z.boolean(),
  identificacao: z.object({ nome: z.string().max(120).optional(), contato: z.string().max(160).optional() }).optional(),
  categoria: z.enum(CATEGORIAS),
  quando: z.string().max(120).optional(),
  local: z.string().max(200).optional(),
  envolvidos: z.string().max(1000).optional(),
  testemunhas: z.string().max(1000).optional(),
  relato: z.string().trim().min(20).max(8000),
  ainda_ocorre: z.boolean().optional(),
  anexos: z.array(Anexo).max(5).default([]),
});
const Acesso = z.object({ protocolo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}-[A-Z0-9]{3}-[A-Z0-9]{3}$/), senha: z.string().min(6).max(40) });
const Consultar = Acesso.extend({ action: z.literal("consultar") });
const Responder = Acesso.extend({ action: z.literal("responder"), mensagem: z.string().trim().min(1).max(4000), anexos: z.array(Anexo).max(3).default([]) });
const Corpo = z.discriminatedUnion("action", [Enviar, Consultar, Responder]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function salvarAnexos(admin: ReturnType<typeof db>, denunciaId: string, anexos: z.infer<typeof Anexo>[], por: string) {
  for (const a of anexos) {
    const bytes = deB64(a.base64);
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10 MB");
    const sha = await sha256Hex(bytes);
    const path = `${denunciaId}/${crypto.randomUUID()}.bin`;
    const { error } = await admin.storage.from("denuncias-anexos").upload(path, await cifrarBytes(bytes), { contentType: "application/octet-stream" });
    if (error) throw new Error("Falha ao guardar anexo");
    await admin.from("denuncias_anexos").insert({
      denuncia_id: denunciaId, path, nome_cifrado: await cifrarTexto(a.nome), mime: a.mime,
      tamanho: bytes.length, sha256: sha, enviado_por: por,
    });
  }
}

async function avisarComite(admin: ReturnType<typeof db>, protocolo: string, texto: string) {
  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return;
    const { data: papeis } = await admin.from("user_roles").select("user_id").eq("role", "compliance");
    const emails: string[] = [];
    for (const p of papeis ?? []) {
      const { data } = await admin.auth.admin.getUserById(p.user_id);
      if (data.user?.email) emails.push(data.user.email);
    }
    if (!emails.length) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Senex Care <nao-responda@senexcare.app>",
        to: emails,
        subject: `Canal de Denúncias – protocolo ${protocolo}`,
        html: `<p>${texto} – protocolo <b>${protocolo}</b>.</p><p>Acesse o Canal de Denúncias no SenexCare para ver os detalhes.</p>`,
      }),
    });
  } catch { /* aviso é opcional */ }
}

async function autenticar(admin: ReturnType<typeof db>, protocolo: string, senha: string) {
  const { data: d } = await admin.from("denuncias").select("*").eq("protocolo", protocolo).maybeSingle();
  if (!d) return { erro: "Protocolo ou senha inválidos" };
  if (d.bloqueado_ate && new Date(d.bloqueado_ate) > new Date()) return { erro: "Muitas tentativas. Tente novamente em 30 minutos." };
  if (!(await conferirSenha(senha, d.senha_hash))) {
    const t = d.tentativas_falhas + 1;
    await admin.from("denuncias").update({
      tentativas_falhas: t >= 5 ? 0 : t,
      bloqueado_ate: t >= 5 ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
    }).eq("id", d.id);
    return { erro: "Protocolo ou senha inválidos" };
  }
  if (d.tentativas_falhas) await admin.from("denuncias").update({ tentativas_falhas: 0 }).eq("id", d.id);
  return { d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const p = Corpo.safeParse(await req.json());
    if (!p.success) return json({ error: "Dados inválidos", campos: p.error.flatten().fieldErrors }, 400);
    const admin = db();
    const b = p.data;

    if (b.action === "enviar") {
      const { data: tenant } = await admin.from("tenants").select("id").order("created_at").limit(1).maybeSingle();
      const protocolo = gerarProtocolo();
      const senha = gerarSenha();
      const dados = {
        identificacao: b.anonima ? null : b.identificacao ?? null,
        quando: b.quando ?? "", local: b.local ?? "", envolvidos: b.envolvidos ?? "",
        testemunhas: b.testemunhas ?? "", relato: b.relato,
      };
      const { data: d, error } = await admin.from("denuncias").insert({
        tenant_id: tenant?.id ?? null, protocolo, senha_hash: await hashSenha(senha), anonima: b.anonima,
        categoria: b.categoria, ainda_ocorre: b.ainda_ocorre ?? null, dados_cifrados: await cifrarTexto(dados),
      }).select("id, prazo_resposta").single();
      if (error || !d) throw new Error("Falha ao registrar");
      await salvarAnexos(admin, d.id, b.anexos, "denunciante");
      await admin.from("denuncias_auditoria").insert({ denuncia_id: d.id, protocolo, acao: "recebida", detalhe: "Denúncia registrada pelo canal público" });
      await avisarComite(admin, protocolo, "Nova denúncia recebida");
      return json({ protocolo, senha, prazo_resposta: d.prazo_resposta });
    }

    const r = await autenticar(admin, b.protocolo, b.senha);
    if (!r.d) return json({ error: r.erro }, 401);
    const d = r.d;

    if (b.action === "responder") {
      await admin.from("denuncias_mensagens").insert({ denuncia_id: d.id, autor: "denunciante", conteudo_cifrado: await cifrarTexto(b.mensagem) });
      await salvarAnexos(admin, d.id, b.anexos, "denunciante");
      await admin.from("denuncias_auditoria").insert({ denuncia_id: d.id, protocolo: d.protocolo, acao: "mensagem_denunciante", detalhe: "Denunciante enviou nova mensagem" });
      await avisarComite(admin, d.protocolo, "Nova mensagem do denunciante");
    }

    const { data: msgs } = await admin.from("denuncias_mensagens").select("autor, conteudo_cifrado, created_at")
      .eq("denuncia_id", d.id).neq("autor", "interna").order("created_at");
    const { data: anexos } = await admin.from("denuncias_anexos").select("nome_cifrado, created_at, enviado_por").eq("denuncia_id", d.id).order("created_at");
    return json({
      protocolo: d.protocolo, situacao: d.situacao, conclusao: d.conclusao, categoria: d.categoria,
      criado_em: d.created_at, atualizado_em: d.updated_at, prazo_resposta: d.prazo_resposta,
      mensagens: await Promise.all((msgs ?? []).map(async (m) => ({ autor: m.autor, texto: await decifrarTexto<string>(m.conteudo_cifrado), em: m.created_at }))),
      anexos: await Promise.all((anexos ?? []).map(async (a) => ({ nome: await decifrarTexto<string>(a.nome_cifrado), em: a.created_at, por: a.enviado_por }))),
    });
  } catch (_e) {
    console.error("denuncia-publica: falha no processamento");
    return json({ error: "Não foi possível concluir agora. Tente novamente." }, 500);
  }
});
