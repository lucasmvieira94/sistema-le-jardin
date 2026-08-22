/**
 * assinatura-publica
 * ---------------------------------------------------------------------------
 * Fluxo do signatário externo (funcionário, cliente ou responsável), acessado
 * por link com token único — sem login.
 *
 * Ações:
 *  - obter        : devolve o documento e os dados do signatário (registra abertura).
 *  - solicitar_otp: gera e envia um código de 6 dígitos por e-mail ou WhatsApp.
 *  - assinar      : valida o OTP (ou a biometria facial já validada no cliente),
 *                   grava a assinatura com IP, dispositivo, geolocalização e hash.
 *  - recusar      : registra a recusa com o motivo informado.
 *
 * Evidências coletadas atendem aos requisitos de autoria e integridade da
 * MP 2.200-2/2001 (art. 10, §2º) e da Lei 14.063/2020.
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

function gerarOtp(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1000000).padStart(6, '0');
}

function normalizarTelefone(tel: string): string {
  const digits = (tel || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

function mascararEmail(email?: string | null) {
  if (!email) return null;
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

function mascararTelefone(tel?: string | null) {
  if (!tel) return null;
  const d = tel.replace(/\D/g, '');
  return `(${d.slice(-11, -9) || '**'}) *****-${d.slice(-4)}`;
}

async function enviarEmail(para: string, assunto: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('Envio de e-mail não configurado');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || 'Senex Care <nao-responda@senexcare.app>',
      to: [para], subject: assunto, html,
    }),
  });
  if (!res.ok) throw new Error('Falha ao enviar o e-mail com o código');
}

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  if (!sid || !auth || !from) throw new Error('Envio por WhatsApp não configurado');
  const body = new URLSearchParams();
  body.append('From', `whatsapp:${from}`);
  body.append('To', `whatsapp:${normalizarTelefone(telefone)}`);
  body.append('ContentSid', 'HX333047c068881b30f385de9e9fce1957');
  body.append('ContentVariables', JSON.stringify({ '1': mensagem }));
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${auth}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Falha ao enviar o código por WhatsApp');
}

const OTP_VALIDADE_MIN = 10;
const OTP_MAX_TENTATIVAS = 5;

const METODOS: Record<string, string> = {
  otp_email: 'Código por e-mail',
  otp_sms: 'Código por WhatsApp',
  biometria_facial: 'Biometria facial',
  rubrica_empresa: 'Rubrica institucional da empresa',
};

const fmtBr = (iso?: string | null) =>
  iso ? `${new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (UTC-3)` : '—';

/** Dados públicos (sem OTP/token) dos signatários, usados na via assinada. */
const publico = (s: any) => ({
  id: s.id,
  nome: s.nome,
  cpf: s.cpf,
  papel: s.papel,
  metodo: s.metodo,
  status: s.status,
  ordem: s.ordem,
  assinado_em: s.assinado_em,
  ip_origem: s.ip_origem,
  user_agent: s.user_agent,
  hash_assinatura: s.hash_assinatura,
  rubrica_base64: s.rubrica_base64,
  motivo_recusa: s.motivo_recusa,
});

/** Bloco HTML de assinaturas anexado à cópia enviada por e-mail. */
function blocoAssinaturasHTML(hashDoc: string, lista: any[]) {
  const itens = lista
    .map(
      (s) => `
      <div style="border:1px solid #d1d5db;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:bold">${s.nome} — ${s.papel}</div>
        ${s.rubrica_base64 ? `<img src="${s.rubrica_base64}" style="max-height:60px;margin:6px 0" />` : ''}
        <div style="font-size:12px;color:#374151;line-height:1.5">
          CPF: ${s.cpf ?? '—'}<br/>
          Método: ${METODOS[s.metodo] ?? s.metodo}<br/>
          Assinado em: ${fmtBr(s.assinado_em)}<br/>
          IP: ${s.ip_origem ?? '—'}<br/>
          <span style="word-break:break-all">Hash: ${s.hash_assinatura ?? '—'}</span>
        </div>
      </div>`,
    )
    .join('');
  return `
    <div style="margin-top:20px;border-top:2px solid #111;padding-top:12px">
      <h3 style="font-size:15px">ASSINATURAS ELETRÔNICAS</h3>
      ${itens}
      <p style="font-size:11px;color:#374151;word-break:break-all">
        Hash SHA-256 do documento: ${hashDoc}<br/>
        Assinado nos termos da MP 2.200-2/2001 (art. 10, §2º) e da Lei 14.063/2020.
      </p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const ua = req.headers.get('user-agent') || null;

    const body = await req.json().catch(() => ({}));
    const { action, token } = body;
    if (!token) return json({ error: 'Token ausente' }, 400);

    const { data: sig } = await admin
      .from('assinatura_signatarios')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (!sig) return json({ error: 'Link inválido ou expirado' }, 404);

    const { data: env } = await admin
      .from('assinatura_envelopes')
      .select('id, titulo, tipo, conteudo_html, hash_documento, status, mensagem, expira_em')
      .eq('id', sig.envelope_id)
      .maybeSingle();
    if (!env) return json({ error: 'Documento não encontrado' }, 404);

    const expirado = new Date(sig.token_expira_em).getTime() < Date.now();
    const bloqueado = env.status === 'cancelado' || expirado;

    // ------------------------------------------------------------------ OBTER
    if (!action || action === 'obter') {
      if (sig.status === 'pendente' || sig.status === 'enviado') {
        await admin.from('assinatura_signatarios')
          .update({ status: 'visualizado', visualizado_em: sig.visualizado_em ?? new Date().toISOString() })
          .eq('id', sig.id);
        await admin.from('assinatura_eventos').insert({
          envelope_id: env.id, signatario_id: sig.id, evento: 'visualizado', ip_origem: ip, user_agent: ua,
        });
      }
      const { data: todos } = await admin
        .from('assinatura_signatarios')
        .select('*')
        .eq('envelope_id', env.id)
        .order('ordem', { ascending: true });
      return json({
        envelope: {
          id: env.id, titulo: env.titulo, tipo: env.tipo, conteudo_html: env.conteudo_html,
          hash_documento: env.hash_documento, status: env.status, mensagem: env.mensagem, expira_em: env.expira_em,
        },
        signatario: {
          id: sig.id, nome: sig.nome, papel: sig.papel, metodo: sig.metodo, status: sig.status,
          assinado_em: sig.assinado_em, motivo_recusa: sig.motivo_recusa,
          funcionario_id: sig.funcionario_id,
          email_mascarado: mascararEmail(sig.email),
          telefone_mascarado: mascararTelefone(sig.telefone),
        },
        expirado,
        cancelado: env.status === 'cancelado',
        signatarios: (todos ?? []).map(publico),
      });
    }

    if (sig.status === 'assinado') return json({ error: 'Este documento já foi assinado por você' }, 400);
    if (sig.status === 'recusado') return json({ error: 'Você já recusou este documento' }, 400);
    if (bloqueado) return json({ error: expirado ? 'Link expirado' : 'Documento cancelado' }, 400);

    // ----------------------------------------------------------- SOLICITAR OTP
    if (action === 'solicitar_otp') {
      const codigo = gerarOtp();
      const hash = await sha256Hex(`${token}:${codigo}`);
      await admin.from('assinatura_signatarios').update({
        otp_hash: hash,
        otp_expira_em: new Date(Date.now() + OTP_VALIDADE_MIN * 60000).toISOString(),
        otp_tentativas: 0,
        otp_enviado_em: new Date().toISOString(),
      }).eq('id', sig.id);

      const msg = `Seu código de assinatura é ${codigo}. Válido por ${OTP_VALIDADE_MIN} minutos. Documento: ${env.titulo}.`;
      if (sig.metodo === 'otp_sms') {
        if (!sig.telefone) return json({ error: 'Telefone não cadastrado' }, 400);
        await enviarWhatsApp(sig.telefone, msg);
      } else {
        if (!sig.email) return json({ error: 'E-mail não cadastrado' }, 400);
        await enviarEmail(sig.email, `Código de assinatura — ${env.titulo}`, `
          <div style="font-family:Arial,sans-serif;color:#1f2937">
            <p>Olá, <strong>${sig.nome}</strong>.</p>
            <p>Use o código abaixo para confirmar sua assinatura eletrônica:</p>
            <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#047857">${codigo}</p>
            <p style="font-size:12px;color:#6b7280">Válido por ${OTP_VALIDADE_MIN} minutos. Não compartilhe este código.</p>
          </div>`);
      }

      await admin.from('assinatura_eventos').insert({
        envelope_id: env.id, signatario_id: sig.id, evento: 'otp_enviado', ip_origem: ip, user_agent: ua,
        metadata: { canal: sig.metodo === 'otp_sms' ? 'whatsapp' : 'email' },
      });
      return json({ ok: true, canal: sig.metodo === 'otp_sms' ? 'whatsapp' : 'email' });
    }

    // ---------------------------------------------------------------- RECUSAR
    if (action === 'recusar') {
      const motivo = (body.motivo || '').trim();
      if (motivo.length < 5) return json({ error: 'Informe o motivo da recusa' }, 400);
      await admin.from('assinatura_signatarios').update({
        status: 'recusado', recusado_em: new Date().toISOString(), motivo_recusa: motivo,
        ip_origem: ip, user_agent: ua,
      }).eq('id', sig.id);
      await admin.from('assinatura_eventos').insert({
        envelope_id: env.id, signatario_id: sig.id, evento: 'recusado', ip_origem: ip, user_agent: ua,
        metadata: { motivo },
      });
      return json({ ok: true });
    }

    // ---------------------------------------------------------------- ASSINAR
    if (action === 'assinar') {
      const { codigo, geolocalizacao, biometria_validada, aceite_termos, rubrica_base64 } = body;
      if (!aceite_termos) return json({ error: 'É necessário aceitar os termos da assinatura eletrônica' }, 400);

      // Confirmação de autoria: OTP ou biometria facial previamente validada
      if (sig.metodo === 'biometria_facial') {
        if (!biometria_validada) return json({ error: 'Validação biométrica não concluída' }, 400);
      } else {
        if (!codigo) return json({ error: 'Informe o código recebido' }, 400);
        if (!sig.otp_hash || !sig.otp_expira_em) return json({ error: 'Solicite um novo código' }, 400);
        if (new Date(sig.otp_expira_em).getTime() < Date.now()) return json({ error: 'Código expirado' }, 400);
        if (sig.otp_tentativas >= OTP_MAX_TENTATIVAS) return json({ error: 'Muitas tentativas. Solicite um novo código.' }, 429);

        const hash = await sha256Hex(`${token}:${String(codigo).trim()}`);
        if (hash !== sig.otp_hash) {
          await admin.from('assinatura_signatarios')
            .update({ otp_tentativas: sig.otp_tentativas + 1 }).eq('id', sig.id);
          await admin.from('assinatura_eventos').insert({
            envelope_id: env.id, signatario_id: sig.id, evento: 'otp_invalido', ip_origem: ip, user_agent: ua,
          });
          return json({ error: 'Código inválido' }, 400);
        }
      }

      const assinadoEm = new Date().toISOString();
      const hashAssinatura = await sha256Hex(
        `${env.hash_documento}|${sig.id}|${sig.nome}|${sig.cpf ?? ''}|${assinadoEm}|${ip ?? ''}|${sig.metodo}`,
      );

      const { error: upErr } = await admin.from('assinatura_signatarios').update({
        status: 'assinado',
        assinado_em: assinadoEm,
        hash_assinatura: hashAssinatura,
        ip_origem: ip,
        user_agent: ua,
        geolocalizacao: geolocalizacao ?? null,
        rubrica_base64: rubrica_base64 ?? null,
        otp_hash: null,
        otp_expira_em: null,
        evidencias: {
          metodo: sig.metodo,
          aceite_termos: true,
          biometria_validada: !!biometria_validada,
          hash_documento: env.hash_documento,
          assinado_em: assinadoEm,
        },
      }).eq('id', sig.id);
      if (upErr) return json({ error: upErr.message }, 500);

      await admin.from('assinatura_eventos').insert({
        envelope_id: env.id, signatario_id: sig.id, evento: 'assinado', ip_origem: ip, user_agent: ua,
        metadata: { metodo: sig.metodo, hash_assinatura: hashAssinatura, geolocalizacao: geolocalizacao ?? null },
      });

      // Cópia do documento assinado enviada ao signatário externo
      const { data: todos } = await admin
        .from('assinatura_signatarios')
        .select('*')
        .eq('envelope_id', env.id)
        .order('ordem', { ascending: true });
      const lista = (todos ?? []).map(publico);

      let copia_enviada = false;
      if (sig.email) {
        try {
          await enviarEmail(
            sig.email,
            `Documento assinado — ${env.titulo}`,
            `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:720px;margin:0 auto">
               <h2 style="color:#065f46">Sua via do documento assinado</h2>
               <p>Olá, <strong>${sig.nome}</strong>. Segue abaixo a via integral do documento
               <strong>${env.titulo}</strong>, já com as assinaturas registradas.</p>
               <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px">${env.conteudo_html ?? ''}</div>
               ${blocoAssinaturasHTML(env.hash_documento, lista)}
             </div>`,
          );
          copia_enviada = true;
          await admin.from('assinatura_eventos').insert({
            envelope_id: env.id, signatario_id: sig.id, evento: 'copia_enviada',
            metadata: { canal: 'email' },
          });
        } catch (e) {
          console.error('Falha ao enviar cópia assinada:', (e as Error).message);
        }
      }

      return json({
        ok: true,
        hash_assinatura: hashAssinatura,
        assinado_em: assinadoEm,
        copia_enviada,
        signatarios: lista,
      });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
