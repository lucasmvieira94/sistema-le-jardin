import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";
import { calcularSha256Hex, extrairIp } from "./auditoria.ts";

const EnviarReciboSchema = z.object({
  email: z.string().email().max(320),
  nomeResponsavel: z.string().max(255).nullable().optional(),
  residenteNome: z.string().min(1).max(255),
  competencia: z.string().min(1).max(50),
  valorPago: z.string().min(1).max(50),
  dataPagamento: z.string().min(1).max(30),
  numeroRecibo: z.string().min(1).max(100),
  pdfBase64: z.string().min(1).max(15_000_000),
  filename: z.string().min(1).max(255),
  documentoId: z.string().uuid(),
  autenticidadeHash: z.string().regex(/^[0-9a-f]{64}$/),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    // Somente usuários autenticados (gestão) podem disparar o envio.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Serviço indisponível" }, 500);
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const parsed = EnviarReciboSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados do recibo inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const {
      email, nomeResponsavel, residenteNome, competencia, valorPago,
      dataPagamento, numeroRecibo, pdfBase64, filename, documentoId,
      autenticidadeHash,
    } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: documento, error: documentoError } = await admin
      .from("documentos_emitidos")
      .select("id, hash_sha256")
      .eq("id", documentoId)
      .eq("hash_sha256", autenticidadeHash)
      .maybeSingle();
    if (documentoError || !documento) {
      return json({ error: "Documento autenticado não encontrado" }, 400);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Serviço de e-mail não configurado" }, 500);
    const resend = new Resend(resendKey);

    const pdfBuffer = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const pdfSha256 = await calcularSha256Hex(pdfBuffer);
    const dadosAuditoria = {
      documento_id: documento.id,
      numero_recibo: numeroRecibo,
      destinatario_email: email.toLowerCase(),
      destinatario_nome: nomeResponsavel ?? null,
      residente_nome: residenteNome,
      pdf_sha256: pdfSha256,
      nome_arquivo: filename,
      enviado_por: user.id,
      ip_origem: extrairIp(req.headers),
      user_agent: req.headers.get("user-agent"),
    };

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="color:#065f46;margin-bottom:4px">Recibo de pagamento</h2>
        <p style="margin-top:0;color:#6b7280">Recibo nº ${numeroRecibo}</p>
        <p>Olá${nomeResponsavel ? `, ${nomeResponsavel}` : ""},</p>
        <p>Confirmamos o recebimento do pagamento referente a <strong>${residenteNome}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#6b7280">Competência</td><td style="text-align:right"><strong>${competencia}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Data do pagamento</td><td style="text-align:right"><strong>${dataPagamento}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Valor pago</td><td style="text-align:right"><strong>${valorPago}</strong></td></tr>
        </table>
        <p>O recibo oficial do sistema está anexo a este e-mail, assinado eletronicamente pela empresa e protegido por código de autenticidade e QR Code para verificação.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">Este é um envio automático. Não responda a esta mensagem.</p>
      </div>`;

    const { data, error } = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM") || "Senex Care <nao-responda@senexcare.app>",
      to: [email],
      subject: `Recibo de pagamento — ${residenteNome} (${competencia})`,
      html,
      attachments: [{ filename: filename || `recibo-${numeroRecibo}.pdf`, content: pdfBuffer }],
    });

    if (error) {
      console.error("Falha Resend:", error);
      const { error: auditError } = await admin.from("recibos_envios_auditoria").insert({
        ...dadosAuditoria,
        status: "falhou",
        erro_detalhes: JSON.stringify(error).slice(0, 4000),
      });
      if (auditError) console.error("Falha ao registrar auditoria do recibo:", auditError);
      return json({ error: "Falha no envio", details: error }, 502);
    }

    const { error: auditError } = await admin.from("recibos_envios_auditoria").insert({
      ...dadosAuditoria,
      status: "enviado",
      provedor_id: data?.id ?? null,
      enviado_em: new Date().toISOString(),
    });
    if (auditError) {
      console.error("Falha ao registrar auditoria do recibo:", auditError);
      return json({ error: "E-mail enviado, mas a auditoria não pôde ser registrada", details: auditError.message }, 500);
    }

    return json({ success: true, id: data?.id ?? null, pdfSha256 });
  } catch (e: any) {
    console.error("enviar-recibo-email:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
};

serve(handler);
