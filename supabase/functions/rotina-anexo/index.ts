// Anexos (foto/PDF) das rotinas de cuidado. Autoriza pelo passe do portal PIN
// (cabeçalho x-portal-token, conferido no banco) e só então usa o service role
// para gravar/ler no bucket privado `rotinas-anexos`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tipoConfere } from "./tipo.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX = 10 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = req.headers.get("x-portal-token");
  if (!token) return json({ error: "Entre novamente com seu código." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const portal = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { "x-portal-token": token } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    if (req.method === "GET") {
      const id = new URL(req.url).searchParams.get("id") ?? "";
      if (!UUID.test(id)) return json({ error: "Anexo inválido" }, 400);
      const { data, error } = await portal.rpc("portal_rotina_anexo_caminho", { _anexo_id: id });
      const a = (data as any[])?.[0];
      if (error || !a) return json({ error: "Anexo não disponível" }, 403);
      const { data: blob, error: e2 } = await admin.storage.from("rotinas-anexos").download(a.arquivo_path);
      if (e2 || !blob) return json({ error: "Arquivo não encontrado" }, 404);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
      if (hash !== a.hash_sha256) return json({ error: "Arquivo com integridade comprometida" }, 409);
      return new Response(bytes, { headers: { ...corsHeaders, "Content-Type": a.tipo_mime, "Cache-Control": "private, no-store" } });
    }
    if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
    const form = await req.formData();
    const rotinaId = String(form.get("rotina_id") ?? "");
    const arquivo = form.get("arquivo");
    if (!UUID.test(rotinaId) || !(arquivo instanceof File)) return json({ error: "Envie a rotina e o arquivo" }, 400);
    if (!TIPOS.has(arquivo.type)) return json({ error: "Use foto (JPG, PNG, WEBP) ou PDF" }, 400);
    if (arquivo.size > MAX) return json({ error: "Arquivo acima de 10 MB" }, 400);
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (!tipoConfere(arquivo.type, bytes)) return json({ error: "Conteúdo não corresponde ao tipo do arquivo" }, 400);
    const { data, error } = await portal.rpc("portal_rotina_anexo_autorizar", { _rotina_id: rotinaId });
    const auth = (data as any[])?.[0];
    if (error || !auth) return json({ error: error?.message ?? "Não autorizado" }, 403);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    const ext = arquivo.type === "application/pdf" ? "pdf" : arquivo.type.split("/")[1];
    const path = `${auth.tenant_id ?? "geral"}/${rotinaId}/${crypto.randomUUID()}.${ext}`;
    const up = await admin.storage.from("rotinas-anexos").upload(path, bytes, { contentType: arquivo.type, upsert: false });
    if (up.error) throw up.error;
    const nome = (arquivo.name || `documento.${ext}`).slice(0, 120);
    const ins = await admin.from("cuidados_rotinas_anexos").insert({ rotina_id: rotinaId, tenant_id: auth.tenant_id, arquivo_path: path, nome_arquivo: nome, tipo_mime: arquivo.type, tamanho_bytes: bytes.length, hash_sha256: hash, enviado_por: auth.funcionario_id }).select("id").single();
    if (ins.error) { await admin.storage.from("rotinas-anexos").remove([path]); throw ins.error; }
    return json({ id: ins.data.id });
  } catch (e) {
    console.error("rotina-anexo", e);
    return json({ error: "Não foi possível processar o anexo" }, 500);
  }
});
