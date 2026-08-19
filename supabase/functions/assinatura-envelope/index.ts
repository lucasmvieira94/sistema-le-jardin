/**
 * assinatura-envelope
 * ---------------------------------------------------------------------------
 * Gestão (lado autenticado) dos envelopes de assinatura eletrônica.
 *
 * Ações:
 *  - criar     : cria o envelope + signatários, calcula o hash SHA-256 do
 *                conteúdo, gera tokens individuais e dispara os convites
 *                (e-mail via Resend / WhatsApp via Twilio).
 *  - reenviar  : reenvia o convite de um signatário pendente.
 *  - cancelar  : cancela o envelope inteiro (com motivo, registrado na auditoria).
 *
 * Base legal: MP 2.200-2/2001, art. 10, §2º e Lei 14.063/2020 — assinatura
 * eletrônica simples/avançada admitida entre as partes, desde que haja
 * comprovação de autoria e integridade (hash + trilha de auditoria).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Token opaco de 32 bytes (URL-safe) para o link individual do signatário. */
function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizarTelefone(tel: string): string {
  const digits = (tel || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

async function enviarEmail(para: string, assunto: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY não configurada');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Assinatura Digital <onboarding@resend.dev>',
      to: [para],
      subject: assunto,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
}

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  if (!sid || !auth || !from) throw new Error('Credenciais Twilio WhatsApp não configuradas');

  const body = new URLSearchParams();
  body.append('From', `whatsapp:${from}`);
  body.append('To', `whatsapp:${normalizarTelefone(telefone)}`);
  body.append('ContentSid', 'HX333047c068881b30f385de9e9fce1957');
  body.append('ContentVariables', JSON.stringify({ '1': mensagem }));

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${auth}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
}

function emailConviteHTML(nome: string, titulo: string, link: string, mensagem?: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <h2 style="color:#065f46">Documento aguardando sua assinatura</h2>
    <p>Olá, <strong>${nome}</strong>.</p>
    <p>Você foi convidado(a) a assinar eletronicamente o documento:</p>
    <p style="font-size:16px;font-weight:bold">${titulo}</p>
    ${mensagem ? `<p style="background:#f0fdf4;padding:12px;border-radius:8px">${mensagem}</p>` : ''}
    <p style="margin:24px 0">
      <a href="${link}" style="background:#047857;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
        Abrir e assinar
      </a>
    </p>
    <p style="font-size:12px;color:#6b7280">
      Link pessoal e intransferível. A assinatura é registrada com data, hora, IP, dispositivo e
      código de verificação, nos termos da MP 2.200-2/2001 (art. 10, §2º) e da Lei 14.063/2020.
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Não autenticado' }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Token inválido' }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const ua = req.headers.get('user-agent') || null;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'criar';
    const baseUrl: string = (body.base_url || '').replace(/\/$/, '');

    // ---------------------------------------------------------------- CANCELAR
    if (action === 'cancelar') {
      const { envelope_id, motivo } = body;
      if (!envelope_id) return json({ error: 'envelope_id obrigatório' }, 400);
      const { error } = await admin
        .from('assinatura_envelopes')
        .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo ?? null })
        .eq('id', envelope_id);
      if (error) return json({ error: error.message }, 500);
      await admin.from('assinatura_eventos').insert({
        envelope_id, evento: 'cancelado', ip_origem: ip, user_agent: ua,
        metadata: { motivo: motivo ?? null, user_id: userId },
      });
      return json({ ok: true });
    }

    // ---------------------------------------------------------------- REENVIAR
    if (action === 'reenviar') {
      const { signatario_id } = body;
      if (!signatario_id) return json({ error: 'signatario_id obrigatório' }, 400);

      const { data: sig } = await admin
        .from('assinatura_signatarios')
        .select('*, assinatura_envelopes!inner(titulo, mensagem)')
        .eq('id', signatario_id)
        .maybeSingle();
      if (!sig) return json({ error: 'Signatário não encontrado' }, 404);
      if (sig.status === 'assinado') return json({ error: 'Signatário já assinou' }, 400);

      const link = `${baseUrl}/assinar/${sig.token}`;
      const titulo = (sig as any).assinatura_envelopes?.titulo ?? 'Documento';
      await despachar(sig, link, titulo, (sig as any).assinatura_envelopes?.mensagem);

      await admin.from('assinatura_signatarios')
        .update({ convite_enviado_em: new Date().toISOString(), status: sig.status === 'pendente' ? 'enviado' : sig.status })
        .eq('id', sig.id);
      await admin.from('assinatura_eventos').insert({
        envelope_id: sig.envelope_id, signatario_id: sig.id, evento: 'convite_reenviado',
        ip_origem: ip, user_agent: ua, metadata: { user_id: userId },
      });
      return json({ ok: true, link });
    }

    // ------------------------------------------------------------------ CRIAR
    const {
      titulo, tipo, referencia_id, referencia_tabela, documento_emitido_id,
      conteudo_html, mensagem, tenant_id, expira_em_dias, signatarios,
    } = body;

    if (!titulo || !tipo || !conteudo_html || !Array.isArray(signatarios) || signatarios.length === 0) {
      return json({ error: 'titulo, tipo, conteudo_html e signatarios são obrigatórios' }, 400);
    }

    const hashDocumento = await sha256Hex(conteudo_html);
    const dias = Number(expira_em_dias) > 0 ? Number(expira_em_dias) : 30;
    const expiraEm = new Date(Date.now() + dias * 86400000).toISOString();

    const { data: envelope, error: envErr } = await admin
      .from('assinatura_envelopes')
      .insert({
        tenant_id: tenant_id ?? null,
        titulo, tipo,
        referencia_id: referencia_id ?? null,
        referencia_tabela: referencia_tabela ?? null,
        documento_emitido_id: documento_emitido_id ?? null,
        conteudo_html,
        hash_documento: hashDocumento,
        mensagem: mensagem ?? null,
        expira_em: expiraEm,
        criado_por: userId,
        status: 'aguardando',
      })
      .select()
      .single();
    if (envErr) return json({ error: envErr.message }, 500);

    // Rubrica institucional pré-cadastrada (assina automaticamente pela empresa)
    const { data: config } = await admin
      .from('configuracoes_empresa')
      .select('assinatura_empresa_base64, assinatura_empresa_nome, assinatura_empresa_cargo, assinatura_empresa_cpf')
      .limit(1)
      .maybeSingle();

    const criados: any[] = [];
    const falhasEnvio: string[] = [];

    for (const [i, s] of signatarios.entries()) {
      const tk = gerarToken();
      const metodo = s.metodo || 'otp_email';
      const ehEmpresa = metodo === 'rubrica_empresa';

      const registro: Record<string, unknown> = {
        envelope_id: envelope.id,
        tenant_id: tenant_id ?? null,
        nome: ehEmpresa ? (s.nome || config?.assinatura_empresa_nome || 'Representante legal') : s.nome,
        cpf: ehEmpresa ? (s.cpf || config?.assinatura_empresa_cpf || null) : (s.cpf ?? null),
        email: s.email ?? null,
        telefone: s.telefone ?? null,
        papel: s.papel || (ehEmpresa ? 'empresa' : 'cliente'),
        metodo,
        ordem: s.ordem ?? i + 1,
        funcionario_id: s.funcionario_id ?? null,
        token: tk,
        token_expira_em: expiraEm,
        status: 'pendente',
      };

      if (ehEmpresa) {
        // Assinatura institucional aplicada no ato da emissão
        registro.status = 'assinado';
        registro.assinado_em = new Date().toISOString();
        registro.rubrica_base64 = config?.assinatura_empresa_base64 ?? null;
        registro.ip_origem = ip;
        registro.user_agent = ua;
        registro.hash_assinatura = await sha256Hex(
          `${hashDocumento}|${registro.nome}|${registro.assinado_em}|rubrica_empresa`,
        );
        registro.evidencias = {
          metodo: 'rubrica_empresa',
          cargo: config?.assinatura_empresa_cargo ?? null,
          aplicada_por: userId,
        };
      }

      const { data: sigRow, error: sigErr } = await admin
        .from('assinatura_signatarios').insert(registro).select().single();
      if (sigErr) return json({ error: sigErr.message }, 500);

      await admin.from('assinatura_eventos').insert({
        envelope_id: envelope.id,
        signatario_id: sigRow.id,
        evento: ehEmpresa ? 'assinado' : 'criado',
        ip_origem: ip,
        user_agent: ua,
        metadata: { metodo, papel: sigRow.papel },
      });

      if (!ehEmpresa && baseUrl) {
        const link = `${baseUrl}/assinar/${tk}`;
        try {
          await despachar(sigRow, link, titulo, mensagem);
          await admin.from('assinatura_signatarios')
            .update({ convite_enviado_em: new Date().toISOString(), status: 'enviado' })
            .eq('id', sigRow.id);
          await admin.from('assinatura_eventos').insert({
            envelope_id: envelope.id, signatario_id: sigRow.id, evento: 'convite_enviado',
            metadata: { canal: metodo === 'otp_sms' ? 'whatsapp' : 'email' },
          });
          sigRow.status = 'enviado';
        } catch (e) {
          falhasEnvio.push(`${sigRow.nome}: ${(e as Error).message}`);
        }
        sigRow.link = link;
      }
      criados.push(sigRow);
    }

    return json({ envelope, signatarios: criados, falhas_envio: falhasEnvio });

    // Helper de despacho do convite conforme o método escolhido
    async function despachar(sig: any, link: string, tituloDoc: string, msg?: string) {
      if (sig.metodo === 'otp_sms') {
        if (!sig.telefone) throw new Error('Telefone não informado');
        await enviarWhatsApp(
          sig.telefone,
          `Olá ${sig.nome}, você tem um documento para assinar: ${tituloDoc}. Acesse: ${link}`,
        );
      } else {
        if (!sig.email) throw new Error('E-mail não informado');
        await enviarEmail(sig.email, `Assinatura pendente: ${tituloDoc}`, emailConviteHTML(sig.nome, tituloDoc, link, msg));
      }
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
