/**
 * Agente de IA de suporte para falhas de envio de e-mail.
 * Recebe o erro, pede à IA um diagnóstico e uma sugestão de correção,
 * grava em `erros_envio_suporte` e avisa o suporte por e-mail.
 * Nunca lança exceção: uma falha aqui não pode mascarar o erro original.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface Diagnostico { diagnostico: string; sugestao: string; gravidade: string }

const SUPORTE_PADRAO = "lucasmoraesv.dev@gmail.com";

async function perguntarIA(origem: string, erro: string, contexto: Record<string, unknown>): Promise<Diagnostico> {
  const fallback = { diagnostico: "Não foi possível analisar automaticamente.", sugestao: "Verifique os registros do envio e tente novamente.", gravidade: "media" };
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return fallback;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "diagnostico", strict: true,
            schema: {
              type: "object", additionalProperties: false,
              required: ["diagnostico", "sugestao", "gravidade"],
              properties: {
                diagnostico: { type: "string" },
                sugestao: { type: "string" },
                gravidade: { type: "string", enum: ["baixa", "media", "alta"] },
              },
            },
          },
        },
        messages: [
          { role: "system", content: "Você é o suporte técnico do sistema SenexCare (gestão de casas de repouso). Analise falhas de envio de e-mail (Resend, validação de dados, autenticidade de documentos). Responda em português do Brasil, de forma curta: diagnóstico da causa provável e sugestão prática de correção para o gestor ou para o desenvolvedor. Nunca peça ou exponha chaves de API." },
          { role: "user", content: `Origem: ${origem}\nErro: ${erro}\nContexto: ${JSON.stringify(contexto).slice(0, 3000)}` },
        ],
      }),
    });
    if (!resp.ok) { console.error("IA diagnóstico", resp.status, await resp.text()); return fallback; }
    const j = await resp.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return { ...fallback, ...parsed };
  } catch (e) {
    console.error("IA diagnóstico falhou:", e);
    return fallback;
  }
}

export async function diagnosticarErroEnvio(
  admin: SupabaseClient,
  params: { origem: string; erro: string; contexto?: Record<string, unknown>; usuarioId?: string | null },
): Promise<Diagnostico | null> {
  try {
    const contexto = params.contexto ?? {};
    const d = await perguntarIA(params.origem, params.erro, contexto);

    let enviado = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM") || "Senex Care <nao-responda@senexcare.app>",
          to: [Deno.env.get("SUPORTE_EMAIL") || SUPORTE_PADRAO],
          subject: `[Suporte SenexCare] Falha de envio — ${params.origem} (${d.gravidade})`,
          html: `<h3>Falha de envio: ${params.origem}</h3><p><b>Erro:</b> ${params.erro.replace(/</g, "&lt;")}</p><p><b>Diagnóstico da IA:</b> ${d.diagnostico}</p><p><b>Sugestão:</b> ${d.sugestao}</p><pre>${JSON.stringify(contexto, null, 2).replace(/</g, "&lt;").slice(0, 3000)}</pre>`,
        }),
      });
      enviado = r.ok;
      if (!r.ok) console.error("Aviso ao suporte falhou", r.status, await r.text());
    }

    await admin.from("erros_envio_suporte").insert({
      origem: params.origem, erro: params.erro.slice(0, 4000), contexto,
      diagnostico: d.diagnostico, sugestao: d.sugestao, gravidade: d.gravidade,
      enviado_suporte: enviado, usuario_id: params.usuarioId ?? null,
    });
    return d;
  } catch (e) {
    console.error("diagnosticarErroEnvio:", e);
    return null;
  }
}
