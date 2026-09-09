import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnviarReciboRequest {
  email: string;
  nomeResponsavel?: string | null;
  residenteNome: string;
  competencia: string; // rótulo já formatado, ex.: "Setembro/2026"
  valorPago: string; // já formatado em BRL
  dataPagamento: string; // já formatado dd/mm/aaaa
  numeroRecibo: string;
  pdfBase64: string;
  filename: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const body: EnviarReciboRequest = await req.json();
    const { email, nomeResponsavel, residenteNome, competencia, valorPago, dataPagamento, numeroRecibo, pdfBase64, filename } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (!pdfBase64) return json({ error: "PDF ausente" }, 400);

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
        <p>O recibo em PDF está anexo a este e-mail, com código de autenticidade e QR Code para verificação.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">Este é um envio automático. Não responda a esta mensagem.</p>
      </div>`;

    const resposta = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM") || "Senex Care <nao-responda@senexcare.app>",
      to: [email],
      subject: `Recibo de pagamento — ${residenteNome} (${competencia})`,
      html,
      attachments: [{ filename: filename || `recibo-${numeroRecibo}.pdf`, content: pdfBuffer }],
    });

    if ((resposta as any)?.error) {
      console.error("Falha Resend:", (resposta as any).error);
      return json({ error: "Falha no envio", details: (resposta as any).error }, 502);
    }

    return json({ success: true, id: (resposta as any)?.data?.id ?? null });
  } catch (e: any) {
    console.error("enviar-recibo-email:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
};

serve(handler);
