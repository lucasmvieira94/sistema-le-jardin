import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const TIPO_LABEL: Record<string, string> = {
  contrato_residente: 'Contrato de Prestação de Serviços',
  contrato_temporario: 'Contrato de Hospedagem Temporária',
  advertencia: 'Documento Disciplinar',
  recibo_pagamento: 'Recibo de Pagamento',
  recibo_despesa: 'Recibo de Pagamento de Despesa',
  anexo_afastamento: 'Documento de Afastamento',
}

function mascararNome(nome: string): string {
  // Exibe apenas o primeiro nome + iniciais dos demais para a verificação pública (LGPD)
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return parts[0] + ' ' + parts.slice(1).map(p => p[0]?.toUpperCase() + '.').join(' ')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    let id = url.searchParams.get('id')
    let hash = url.searchParams.get('hash')
    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}))
      id = id || (typeof body.id === 'string' ? body.id : null)
      hash = hash || (typeof body.hash === 'string' ? body.hash : null)
    }
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash.trim())) return json({ autentico: false, error: 'Hash inválido' }, 400)
    hash = hash.trim().toUpperCase()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
    const ua = req.headers.get('user-agent') || null

    if (body.action === 'obter_codigo') {
      if (!['interno', 'envelope'].includes(String(body.origem)) || typeof body.referencia_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.referencia_id)) return json({ error: 'Referência inválida' }, 400)
      let referencia = body.referencia_id
      if (body.origem === 'interno') {
        if (typeof body.hash_assinatura !== 'string' || !/^[a-f0-9]{64}$/i.test(body.hash_assinatura)) return json({ error: 'Assinatura inválida' }, 400)
        const { data: assinatura } = await admin.from('documentos_internos_assinaturas').select('id,hash_documento').eq('referencia_id', referencia).eq('hash_assinatura', body.hash_assinatura).eq('status', 'assinado').maybeSingle()
        if (!assinatura || assinatura.hash_documento.toUpperCase() !== hash) return json({ error: 'Assinatura não encontrada' }, 404)
        referencia = assinatura.id
      }
      const { data: codigo } = await admin.from('assinatura_verificacoes').select('codigo_verificador').eq('origem', body.origem).eq('referencia_id', referencia).eq('hash_documento', hash).maybeSingle()
      return codigo ? json(codigo) : json({ error: 'Verificação não encontrada' }, 404)
    }
    if (typeof id !== 'string' || !/^(\d{7,8}|[a-f0-9-]{36})$/i.test(id)) return json({ autentico: false, error: 'Código inválido' }, 400)
    const { data: verificacao } = await admin.from('assinatura_verificacoes').select('*').eq('codigo_verificador', id).maybeSingle()
    if (verificacao) {
      const autentico = verificacao.hash_documento === hash
      await admin.from('assinatura_verificacoes_acessos').insert({ verificacao_id: verificacao.id, autentico, ip_origem: ip, user_agent: ua })
      if (!autentico) return json({ autentico: false, motivo: 'Hash não corresponde ao documento registrado.' })
      let assinaturas = []
      let titulo = ''
      if (verificacao.origem === 'interno') {
        const { data: s } = await admin.from('documentos_internos_assinaturas').select('titulo,funcionario_id,metodo,status,assinado_em,ip_origem,user_agent,hash_assinatura').eq('id', verificacao.referencia_id).maybeSingle()
        if (!s || s.status !== 'assinado') return json({ autentico: false, motivo: 'Assinatura indisponível.' })
        const { data: funcionario } = await admin.from('funcionarios').select('nome').eq('id', s.funcionario_id).maybeSingle()
        titulo = s.titulo
        assinaturas = [{ nome: mascararNome(funcionario?.nome ?? ''), papel: 'Colaborador', metodo: s.metodo, status: s.status, assinado_em: s.assinado_em, ip_origem: s.ip_origem, user_agent: s.user_agent, hash_assinatura: s.hash_assinatura }]
      } else {
        const { data: envelope } = await admin.from('assinatura_envelopes').select('titulo,status').eq('id', verificacao.referencia_id).maybeSingle()
        if (!envelope || envelope.status === 'cancelado') return json({ autentico: false, motivo: 'Documento cancelado ou indisponível.' })
        titulo = envelope.titulo
        const { data: lista } = await admin.from('assinatura_signatarios').select('nome,papel,metodo,status,assinado_em,ip_origem,user_agent,hash_assinatura').eq('envelope_id', verificacao.referencia_id).eq('status', 'assinado').order('ordem')
        assinaturas = (lista ?? []).map((s) => ({ ...s, nome: mascararNome(s.nome) }))
        if (!assinaturas.length) return json({ autentico: false, motivo: 'Documento ainda sem assinatura.' })
      }
      return json({ autentico: true, codigo_verificador: verificacao.codigo_verificador, tipo_label: titulo, emitido_em: verificacao.created_at, assinaturas })
    }
    const porCodigo = /^\d{7,8}$/.test(id)
    const consulta = admin
      .from('documentos_emitidos')
      .select('id, codigo_verificador, tipo, numero_documento, titular_nome, hash_sha256, emitido_em')
    const { data: doc } = porCodigo
      ? await consulta.eq('codigo_verificador', id).maybeSingle()
      : await consulta.eq('id', id).maybeSingle()

    if (!doc) {
      // Registrar tentativa falha sem id válido — não há documento_id; logamos apenas se temos id.
      return new Response(JSON.stringify({ autentico: false, motivo: 'Documento não encontrado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const autentico = doc.hash_sha256.toUpperCase() === hash.toUpperCase()

    await admin.from('documentos_auditoria').insert({
      documento_id: doc.id,
      acao: 'verificado_publico',
      ip_origem: ip,
      user_agent: ua,
      metadata: { autentico, hash_informado_prefix: hash.slice(0, 12) },
    })

    return new Response(
      JSON.stringify({
        autentico,
        tipo: doc.tipo,
        tipo_label: TIPO_LABEL[doc.tipo] ?? doc.tipo,
        numero_documento: doc.numero_documento,
        codigo_verificador: doc.codigo_verificador,
        titular_mascarado: mascararNome(doc.titular_nome || ''),
        emitido_em: doc.emitido_em,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ autentico: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})