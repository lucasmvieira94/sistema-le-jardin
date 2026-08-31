/**
 * Função utilitária de diagnóstico do envio de e-mails (Resend).
 * - Valida a API key e o domínio verificado
 * - Envia um e-mail de teste para o destinatário informado
 *
 * Uso: POST { "para": "email@dominio.com" }
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const key = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM') || 'Senex Care <nao-responda@senexcare.app>';
    if (!key) return json({ ok: false, etapa: 'config', error: 'RESEND_API_KEY não configurada' }, 500);

    // 1) Diagnóstico dos domínios (opcional: chaves "sending only" não têm essa permissão)
    let dominios: unknown = 'indisponível (API key com permissão apenas de envio)';
    const domRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const domBody = await domRes.text();
    if (domRes.ok) {
      dominios = (JSON.parse(domBody)?.data ?? []).map((d: any) => ({
        name: d.name,
        status: d.status,
        region: d.region,
      }));
    }

    // 2) Envio de teste (opcional)
    const { para } = await req.json().catch(() => ({ para: null }));
    if (!para) return json({ ok: true, from, dominios, enviado: false });

    const envio = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [para],
        subject: 'Teste de envio — Assinatura Eletrônica Senex Care',
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
            <h2 style="color:#065f46">Teste de envio de e-mail</h2>
            <p>Este é um e-mail de diagnóstico do módulo de <strong>assinatura eletrônica</strong>.</p>
            <p>Se você recebeu esta mensagem, o domínio remetente está verificado e os convites de assinatura serão entregues normalmente.</p>
            <p style="font-size:12px;color:#6b7280">Remetente: ${from}</p>
          </div>`,
      }),
    });
    const envioBody = await envio.text();
    if (!envio.ok) {
      return json({ ok: false, etapa: 'envio', from, dominios, status: envio.status, details: envioBody }, envio.status);
    }

    return json({ ok: true, from, dominios, enviado: true, resposta: JSON.parse(envioBody) });
  } catch (e) {
    return json({ ok: false, etapa: 'excecao', error: String(e) }, 500);
  }
});
