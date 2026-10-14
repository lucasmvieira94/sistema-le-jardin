/**
 * Recebe erros de qualquer módulo (telas e portal PIN), pede diagnóstico à IA,
 * grava em `erros_envio_suporte` e avisa o suporte. Aceita chamadas sem login
 * (portal do colaborador), com validação e limite de tamanho.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { diagnosticarErroEnvio } from "../_shared/diagnosticoEnvio.ts";

const Corpo = z.object({
  modulo: z.string().min(1).max(80),
  tipo: z.string().max(60).optional(),
  mensagem: z.string().min(1).max(2000),
  pilha: z.string().max(3000).optional(),
  rota: z.string().max(300).optional(),
  navegador: z.string().max(300).optional(),
  contexto: z.record(z.unknown()).optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const p = Corpo.safeParse(await req.json());
    if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let usuarioId: string | null = null;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      usuarioId = data.user?.id ?? null;
    }

    // Limite simples: se o mesmo erro do mesmo módulo já chegou na última hora, não chama a IA de novo.
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("erros_envio_suporte").select("id", { count: "exact", head: true })
      .eq("origem", p.data.modulo).eq("erro", p.data.mensagem.slice(0, 4000)).gte("created_at", desde);
    if ((count ?? 0) > 0) return json({ diagnostico: "Erro já registrado", sugestao: "", gravidade: "media", repetido: true });

    const d = await diagnosticarErroEnvio(admin, {
      origem: p.data.modulo,
      erro: p.data.mensagem,
      contexto: { tipo: p.data.tipo, rota: p.data.rota, navegador: p.data.navegador, pilha: p.data.pilha, ...(p.data.contexto ?? {}) },
      usuarioId,
    });
    return json(d ?? { diagnostico: "", sugestao: "", gravidade: "media" });
  } catch (e) {
    console.error("diagnosticar-erro:", e);
    return json({ error: "Falha ao registrar erro" }, 500);
  }
});
