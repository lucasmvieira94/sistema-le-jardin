import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";

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
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (token !== serviceKey) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error } = await authClient.auth.getUser();
      if (error || !user) return json({ error: "Não autorizado" }, 401);
    }

    const parsed = EnviarReciboSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados do recibo inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const { email, nomeResponsavel, residenteNome, competencia, valorPago, dataPagamento, numeroRecibo, pdfBase64, filename } = parsed.data;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Serviço de e-mail não configurado" }, 500);
    const resend = new Resend(resendKey);

    const pdfBuffer = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));

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
      return json({ error: "Falha no envio", details: error }, 502);
    }

    return json({ success: true, id: data?.id ?? null });
  } catch (e: any) {
    console.error("enviar-recibo-email:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
};

serve(handler);
