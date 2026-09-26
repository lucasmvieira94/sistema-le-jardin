import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Método inválido' }, 405)
  const token = new URL(req.url).searchParams.get('token')
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) return json({ error: 'Link inválido' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: anexo } = await admin.from('afastamentos_anexos').select('id, pdf_path, hash_pdf, nome_original, revogado_em, documento_id').eq('token', token).maybeSingle()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? null
  const agent = req.headers.get('user-agent') ?? null
  if (!anexo) return json({ error: 'Documento não encontrado' }, 404)
  const audit = async (resultado: string) => {
    const { error } = await admin.from('afastamentos_anexos_acessos').insert({ anexo_id: anexo.id, ip, user_agent: agent, resultado })
    if (error) console.error('Falha no registro do acesso:', error)
  }
  if (anexo.revogado_em) { await audit('revogado'); return json({ error: 'Este link foi revogado' }, 410) }
  const { data: file, error } = await admin.storage.from('afastamentos-documentos').download(anexo.pdf_path)
  if (error || !file) { await audit('arquivo_ausente'); return json({ error: 'Arquivo indisponível' }, 404) }
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== anexo.hash_pdf) { await audit('integridade_falhou'); return json({ error: 'Falha na verificação de integridade' }, 409) }
  await audit('visualizado')
  if (anexo.documento_id) await admin.from('documentos_auditoria').insert({ documento_id: anexo.documento_id, acao: 'verificado_publico', ip_origem: ip, user_agent: agent, metadata: { autentico: true, origem: 'anexo_afastamento' } })
  return new Response(bytes, { headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="afastamento-${anexo.id}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
})