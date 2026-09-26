import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const Schema = z.object({
  afastamentoId: z.string().uuid(), tenantId: z.string().uuid(),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/),
  nomeOriginal: z.string().min(1).max(255), formatoOriginal: z.enum(['pdf','jpg','jpeg','png','webp','gif','bmp','tif','tiff','heic','heif','svg','doc','docx','odt']),
  tamanhoOriginal: z.number().int().positive().max(20_000_000), hashOriginal: z.string().regex(/^[a-f0-9]{64}$/),
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método inválido' }, 405)
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
    if (!token) return json({ error: 'Acesso não autorizado' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Acesso não autorizado' }, 401)
    const parsed = Schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const input = parsed.data
    if (input.path !== `${input.tenantId}/${input.afastamentoId}/${input.path.split('/')[2]}`) return json({ error: 'Arquivo inválido' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: role } = await admin.from('user_roles').select('id').eq('user_id', user.id).eq('tenant_id', input.tenantId).eq('role', 'admin').maybeSingle()
    if (!role) return json({ error: 'Apenas gestores podem autenticar anexos' }, 403)
    const { data: afastamento } = await admin.from('afastamentos').select('id, tenant_id, funcionario_id, funcionarios(nome_completo)').eq('id', input.afastamentoId).eq('tenant_id', input.tenantId).maybeSingle()
    if (!afastamento) return json({ error: 'Afastamento não encontrado' }, 404)
    const { data: existing } = await admin.from('afastamentos_anexos').select('id').eq('afastamento_id', input.afastamentoId).is('revogado_em', null).maybeSingle()
    if (existing) return json({ error: 'Revogue o anexo anterior antes de adicionar outro' }, 409)
    const { data: file, error: downloadError } = await admin.storage.from('afastamentos-documentos').download(input.path)
    if (downloadError || !file) return json({ error: 'PDF não encontrado' }, 404)
    if (file.size > 20 * 1024 * 1024) return json({ error: 'PDF excede 20 MB' }, 400)
    const buffer = await file.arrayBuffer()
    if (new TextDecoder().decode(buffer.slice(0, 5)) !== '%PDF-') return json({ error: 'Arquivo não é PDF' }, 400)
    const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)))
    const nome = (afastamento.funcionarios as unknown as { nome_completo: string } | null)?.nome_completo ?? 'Funcionário'
    const { data: doc, error: docError } = await admin.from('documentos_emitidos').insert({
      tipo: 'anexo_afastamento', referencia_id: input.afastamentoId, referencia_tabela: 'afastamentos',
      titular_nome: nome, hash_sha256: hash, tenant_id: input.tenantId, emitido_por: user.id,
      dados_estruturais: { hash_pdf: hash, hash_original: input.hashOriginal, nome_original: input.nomeOriginal, formato_original: input.formatoOriginal },
    }).select('id').single()
    if (docError || !doc) throw docError ?? new Error('Documento não registrado')
    const { data: anexo, error: insertError } = await admin.from('afastamentos_anexos').insert({
      afastamento_id: input.afastamentoId, tenant_id: input.tenantId, criado_por: user.id,
      nome_original: input.nomeOriginal, formato_original: input.formatoOriginal, tamanho_original: input.tamanhoOriginal,
      hash_original: input.hashOriginal, pdf_path: input.path, tamanho_pdf: file.size, hash_pdf: hash, documento_id: doc.id,
    }).select('id, token').single()
    if (insertError || !anexo) {
      await admin.from('documentos_emitidos').delete().eq('id', doc.id)
      throw insertError ?? new Error('Anexo não registrado')
    }
    await admin.from('documentos_auditoria').insert({ documento_id: doc.id, acao: 'gerado', user_id: user.id, ip_origem: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null, user_agent: req.headers.get('user-agent') })
    return json({ id: anexo.id, token: anexo.token, hash })
  } catch (error) {
    console.error('Erro ao autenticar anexo:', error)
    return json({ error: 'Não foi possível autenticar o anexo' }, 500)
  }
})