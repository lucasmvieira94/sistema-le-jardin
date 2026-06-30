import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIPO_LABEL: Record<string, string> = {
  contrato_residente: 'Contrato de Prestação de Serviços',
  contrato_temporario: 'Contrato de Hospedagem Temporária',
  advertencia: 'Documento Disciplinar',
  recibo_pagamento: 'Recibo de Pagamento',
  recibo_despesa: 'Recibo de Pagamento de Despesa',
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
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      id = id || body.id
      hash = hash || body.hash
    }
    if (!id || !hash) {
      return new Response(JSON.stringify({ autentico: false, error: 'Parâmetros ausentes' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: doc } = await admin
      .from('documentos_emitidos')
      .select('id, tipo, numero_documento, titular_nome, hash_sha256, emitido_em')
      .eq('id', id)
      .maybeSingle()

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
    const ua = req.headers.get('user-agent') || null

    if (!doc) {
      // Registrar tentativa falha sem id válido — não há documento_id; logamos apenas se temos id.
      return new Response(JSON.stringify({ autentico: false, motivo: 'Documento não encontrado' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const autentico = doc.hash_sha256 === hash

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
        titular_mascarado: mascararNome(doc.titular_nome || ''),
        emitido_em: doc.emitido_em,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ autentico: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})