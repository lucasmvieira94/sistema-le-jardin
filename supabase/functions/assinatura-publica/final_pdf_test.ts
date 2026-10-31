import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { hashBytes, renderizarViaAssinada, enviarViasFinais } from '../_shared/assinaturaFinalPDF.ts';

const html = '<h1>Contrato de residente</h1><p>CONTEUDO ORIGINAL PRIMEIRA LINHA</p>' + '<p>Cláusula contratual preservada com obrigações de ambas as partes.</p>'.repeat(110) + '<p>CONTEUDO ORIGINAL ULTIMA LINHA</p>';
const assinaturas = [
  { id: 'empresa', nome: 'Representante da Empresa', papel: 'empresa', status: 'assinado', assinado_em: '2026-10-29T14:12:00Z' },
  { id: 'cliente', nome: 'Contratante', papel: 'cliente', status: 'assinado', assinado_em: '2026-10-29T14:13:00Z', email: 'contratante@example.com' },
];

Deno.test('PDF final preserva documento longo e possui duas assinaturas sem omitir páginas', async () => {
  const env = { titulo: 'Contrato de residente', conteudo_html: html, hash_documento: await hashBytes(new TextEncoder().encode(html)) };
  const bytes = await renderizarViaAssinada(env, assinaturas, '12345678');
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assertEquals(pdf.getPageCount() >= 3, true);
  assertEquals(pdf.getTitle(), env.titulo);
  const content = new TextDecoder('latin1').decode(bytes);
  assertEquals(content.includes('CONTEUDO ORIGINAL PRIMEIRA LINHA'), true);
  assertEquals(content.includes('CONTEUDO ORIGINAL ULTIMA LINHA'), true);
  assertEquals(content.includes('Contratante'), true);
  assertEquals(content.includes('Representante da Empresa'), true);
});

Deno.test('PDF final bloqueia conteúdo adulterado e documento sem assinatura', async () => {
  const env = { titulo: 'Contrato', conteudo_html: html, hash_documento: 'A'.repeat(64) };
  await assertRejects(() => renderizarViaAssinada(env, assinaturas, '12345678'), Error, 'difere');
  await assertRejects(() => renderizarViaAssinada(env, [], '12345678'), Error, 'Nenhuma assinatura');
});

Deno.test('email contém anexo PDF com bytes idênticos aos armazenados, somente após conclusão', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const bytes = await pdf.save();
  const hash = await hashBytes(bytes);
  const env = { id: 'envelope-teste', titulo: 'Contrato', status: 'concluido' };
  const salvo = { arquivo_path: 'arquivo.pdf', hash_pdf: hash };
  const eventos: any[] = [];
  const admin = {
    from: (table: string) => {
      const result: any = table === 'assinatura_envelopes' ? env : table === 'assinatura_pdfs_finais' ? salvo : table === 'assinatura_signatarios' ? assinaturas : [];
      const q: any = { select: () => q, eq: () => q, limit: () => q, single: async () => ({ data: result }), maybeSingle: async () => ({ data: result }), then: (resolve: any) => Promise.resolve({ data: result }).then(resolve), insert: async (row: any) => { eventos.push(row); return {}; } };
      return q;
    },
    storage: { from: () => ({ download: async () => ({ data: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }) }) },
  };
  const fetchOriginal = globalThis.fetch;
  const keyOriginal = Deno.env.get('RESEND_API_KEY');
  Deno.env.set('RESEND_API_KEY', 'test-only');
  const requests: any[] = [];
  globalThis.fetch = (_url, init) => { requests.push(JSON.parse(String(init?.body))); return Promise.resolve(new Response(JSON.stringify({ id: 'email-test' }), { status: 200 })); };
  try {
    assertEquals(await enviarViasFinais(admin, env.id), 1);
    assertEquals(requests[0].to, ['contratante@example.com']);
    const attachment = requests[0].attachments[0];
    const received = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
    assertEquals(await hashBytes(received), hash);
    assertEquals(attachment.filename, 'Contrato_assinado.pdf');
    assertEquals(attachment.content_type, 'application/pdf');
    assertEquals(eventos[0].evento, 'pdf_final_enviado');
    env.status = 'parcial';
    await assertRejects(() => enviarViasFinais(admin, env.id), Error, 'após todas');
    assertEquals(requests.length, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (keyOriginal) Deno.env.set('RESEND_API_KEY', keyOriginal); else Deno.env.delete('RESEND_API_KEY');
  }
});