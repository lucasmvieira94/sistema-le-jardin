import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { anexarCertificadoPDF, pdfBase64 } from '../_shared/certificacaoPDF.ts';
import { gerarFichaPDF } from './pdf.ts';
import { emailResidencial, fichaConcluida } from './regras.ts';

const schema = z.object({ envio_id: z.string().uuid() }).strict();
const sha = async (value: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), b => b.toString(16).padStart(2, '0')).join('');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** A one-use, hashed capability created only by the database authorizes one persisted event.
 * No recipients, clinical answers or PDFs are accepted from an HTTP caller. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const capacidade = req.headers.get('x-ficha-capacidade');
  if (!capacidade || !/^[a-f0-9]{64}$/.test(capacidade)) return json({ error: 'Não autorizado' }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Identificador de envio inválido' }, 400);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url || !key || !resendKey) return json({ error: 'Serviço de envio não configurado' }, 503);
  const db = createClient(url, key);
  const envioId = parsed.data.envio_id;
  const { data: reservas, error: reservaError } = await db.rpc('reservar_envio_ficha', { p_envio: envioId, p_hash: await sha(new TextEncoder().encode(capacidade)) });
  if (reservaError) return json({ error: 'Não foi possível reservar envio' }, 500);
  const envio = reservas?.[0];
  if (!envio) return json({ error: 'Envio indisponível ou não autorizado' }, 409);
  try {
    const { data: ficha, error: fichaError } = await db.from('fichas_acolhimento').select('*').eq('id', envio.ficha_id).single();
    if (fichaError || !ficha || !fichaConcluida(ficha.status)) throw new Error('Ficha não preenchida ou indisponível.');
    let consulta = db.from('configuracoes_empresa').select('nome_empresa,cnpj,endereco,cidade,dominio_email').order('created_at', { ascending: false }).limit(1);
    consulta = ficha.tenant_id ? consulta.eq('tenant_id', ficha.tenant_id) : consulta.is('tenant_id', null);
    const { data: empresa, error: configError } = await consulta.single();
    if (configError || !empresa) throw new Error('Configurações do residencial não encontradas.');
    // Persist recipient and exact PDF before provider call: retries use identical payload/idempotency key.
    const destinatario = envio.destinatario || emailResidencial(empresa.dominio_email);
    let pdf = envio.pdf_base64;
    let documentoId = envio.documento_id;
    if (!pdf) {
      const { data: residente, error: residenteError } = await db.from('residentes').select('nome_completo,tenant_id').eq('id', ficha.residente_id).single();
      if (residenteError || !residente || residente.tenant_id !== ficha.tenant_id) throw new Error('Residente não encontrado nesta instituição.');
      const original = gerarFichaPDF(ficha, residente.nome_completo, empresa);
      const hash = (await sha(original)).toUpperCase();
      const { data: certificado, error: certError } = await db.from('documentos_emitidos').insert({
        tipo: 'ficha_acolhimento', referencia_id: ficha.id, referencia_tabela: 'fichas_acolhimento',
        titular_nome: residente.nome_completo, tenant_id: ficha.tenant_id, hash_sha256: hash,
        dados_estruturais: { titulo: 'Ficha de acolhimento', hash_conteudo: hash, escopo_hash: 'PDF antes do rodapé de certificação' },
      }).select('id,codigo_verificador').single();
      if (certError || !certificado) throw new Error('Não foi possível certificar a ficha.');
      pdf = pdfBase64(await anexarCertificadoPDF(original, certificado.codigo_verificador, hash));
      documentoId = certificado.id;
      const { error: auditError } = await db.from('documentos_auditoria').insert({ documento_id: documentoId, acao: 'gerado', metadata: { origem: 'ficha_acolhimento_email' } });
      if (auditError) throw new Error('Não foi possível auditar a certificação.');
      const { error: salvarError } = await db.from('fichas_acolhimento_envios').update({ destinatario, pdf_base64: pdf, documento_id: documentoId }).eq('id', envioId);
      if (salvarError) throw new Error('Não foi possível preservar o documento para envio.');
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `ficha-acolhimento-${envioId}` },
      body: JSON.stringify({ from: Deno.env.get('RESEND_FROM') || 'Senex Care <nao-responda@senexcare.app>', to: [destinatario],
        subject: 'Ficha de acolhimento preenchida — SenexCare',
        text: 'Uma ficha de acolhimento preenchida está anexada em PDF, com certificação de autenticidade. Contém dados pessoais sensíveis; mantenha o acesso restrito à equipe autorizada do residencial.',
        attachments: [{ filename: `ficha-acolhimento-${ficha.id}.pdf`, content: pdf }],
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      // Do not log provider bodies that may echo personal details.
      throw new Error(`Serviço de e-mail recusou envio (${response.status}, ${failure.name || 'erro'}).`);
    }
    const result = await response.json();
    if (!result.id) throw new Error('Serviço de e-mail não confirmou o envio.');
    const { error: resultError } = await db.from('fichas_acolhimento_envios').update({ status: 'enviado', enviado_em: new Date().toISOString(), provider_id: result.id, erro: null, capacidade_hash: null, processando_em: null, pdf_base64: null }).eq('id', envioId);
    if (resultError) throw new Error('Envio aceito, mas registro da entrega falhou.');
    const { error: cleanupError } = await db.rpc('concluir_ficha_acolhimento_email', { p_envio: envioId });
    if (cleanupError) console.error('Falha ao encerrar tentativas', { envio_id: envioId, code: cleanupError.code });
    return json({ enviado: true, documento_id: documentoId });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha no envio da ficha';
    const { error: auditError } = await db.from('fichas_acolhimento_envios').update({ status: 'falhou', erro: mensagem, processando_em: null, capacidade_hash: null }).eq('id', envioId);
    if (auditError) console.error('Falha ao registrar erro', { envio_id: envioId, code: auditError.code });
    const { error: cleanupError } = await db.rpc('concluir_ficha_acolhimento_email', { p_envio: envioId });
    if (cleanupError) console.error('Falha ao encerrar tentativas', { envio_id: envioId, code: cleanupError.code });
    console.error('Envio de ficha falhou', { envio_id: envioId, erro: mensagem });
    return json({ error: mensagem }, 500);
  }
});