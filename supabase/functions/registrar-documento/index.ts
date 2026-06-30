import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify((value as any)[k])).join(',') + '}'
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = userData.user.id

    const body = await req.json().catch(() => ({}))
    const { tipo, referencia_id, referencia_tabela, numero_documento, titular_nome, dados_estruturais, tenant_id } = body

    if (!tipo || !titular_nome || !dados_estruturais) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!['contrato_residente', 'contrato_temporario', 'advertencia', 'recibo_pagamento', 'recibo_despesa'].includes(tipo)) {
      return new Response(JSON.stringify({ error: 'Tipo inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Hash canônico dos dados estruturais
    const canonical = canonicalStringify({
      tipo,
      referencia_id: referencia_id ?? null,
      numero_documento: numero_documento ?? null,
      titular_nome,
      dados: dados_estruturais,
    })
    const hash = await sha256Hex(canonical)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
    const ua = req.headers.get('user-agent') || null

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Reusar se já existe (mesma hash) — idempotente
    const { data: existente } = await admin
      .from('documentos_emitidos')
      .select('id, hash_sha256')
      .eq('hash_sha256', hash)
      .maybeSingle()

    let documentoId: string
    let acao: 'gerado' | 'reemitido' = 'gerado'

    if (existente) {
      documentoId = existente.id
      acao = 'reemitido'
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('documentos_emitidos')
        .insert({
          tipo,
          referencia_id: referencia_id ?? null,
          referencia_tabela: referencia_tabela ?? null,
          numero_documento: numero_documento ?? null,
          titular_nome,
          hash_sha256: hash,
          dados_estruturais,
          emitido_por: userId,
          tenant_id: tenant_id ?? null,
        })
        .select('id')
        .single()
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      documentoId = inserted.id
    }

    await admin.from('documentos_auditoria').insert({
      documento_id: documentoId,
      acao,
      user_id: userId,
      ip_origem: ip,
      user_agent: ua,
    })

    return new Response(
      JSON.stringify({ id: documentoId, hash, acao }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})