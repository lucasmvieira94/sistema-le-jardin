import { jsPDF } from 'npm:jspdf@4.2.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { parseHTML } from 'npm:linkedom@0.18.12';
import QRCode from 'npm:qrcode@1.5.4';
import { pdfBase64 } from './certificacaoPDF.ts';

const BUCKET = 'documentos-assinados-finais';
const LOGO = 'https://senexcare.app/__l5e/assets-v1/83690979-9b1e-48ba-8142-d26775e6987c/sxcare-assinatura-eletronica.jpg';
export const nomePdfAssinado = (titulo: string) => `${titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 90) || 'documento'}_assinado.pdf`;
export async function hashBytes(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Renderização paginada no servidor: conteúdo inteiro, imagens e assinaturas reais. */
export async function renderizarViaAssinada(env: any, lista: any[], codigo: string): Promise<Uint8Array> {
  if (!/^\d{8}$/.test(codigo) || !/^[a-f0-9]{64}$/i.test(env.hash_documento)) throw new Error('Certificação indisponível');
  const assinados = lista.filter(s => s.status === 'assinado' && s.assinado_em);
  if (!assinados.length) throw new Error('Nenhuma assinatura registrada');
  const html = env.conteudo_html ?? '';
  if (!html.trim()) throw new Error('Conteúdo original indisponível');
  if (await hashBytes(new TextEncoder().encode(html)) !== env.hash_documento.toUpperCase()) throw new Error('Conteúdo difere do documento assinado');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({ title: env.titulo, author: 'SenexCare', subject: 'Via integral assinada eletronicamente' });
  let y = 18;
  const novaPagina = () => { doc.addPage(); y = 18; };
  const escrever = (texto: string, bold = false, size = 11) => {
    doc.setFont('times', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(25);
    const linhas = doc.splitTextToSize(texto.replace(/\s+/g, ' ').trim(), 178);
    for (const linha of linhas) { if (y > 275) novaPagina(); doc.text(linha, 16, y); y += size * 0.48; }
    y += 3;
  };
  const imagem = async (src: string, pagina = false) => {
    let data = src;
    if (!src.startsWith('data:image/')) {
      const url = new URL(src, 'https://senexcare.app');
      if (url.protocol !== 'https:' || !['senexcare.app', 'kvjgmqicictxxfnvhuwl.supabase.co'].includes(url.hostname)) throw new Error('Imagem externa não autorizada');
      const r = await fetch(url, { redirect: 'error' });
      if (!r.ok) throw new Error('Imagem do documento indisponível');
      data = `data:${r.headers.get('content-type') || 'image/png'};base64,${pdfBase64(new Uint8Array(await r.arrayBuffer()))}`;
    }
    const props = doc.getImageProperties(data);
    const w = pagina ? 178 : Math.min(55, props.width * 0.2646);
    const h = Math.min(255, w * props.height / props.width);
    if (y + h > 277) novaPagina();
    doc.addImage(data, props.fileType, pagina ? 16 : (210 - w) / 2, y, w, h);
    y += h + 5;
  };
  const { document } = parseHTML(`<html><body>${html}</body></html>`) as unknown as { document: { body: { childNodes: Iterable<unknown> } } };
  const blocos = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'TR', 'SECTION', 'HEADER', 'FOOTER']);
  let buffer = '';
  const flush = (bold = false, size = 11) => { if (buffer.trim()) escrever(buffer, bold, size); buffer = ''; };
  const visitar = async (node: any): Promise<void> => {
    if (node.nodeType === 3) { buffer += node.textContent; return; }
    const tag = node.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return;
    if (tag === 'IMG') { flush(); await imagem(node.getAttribute('src') ?? '', Boolean(node.closest('.pagina-pdf'))); return; }
    if (tag === 'BR') { flush(); return; }
    const bloco = blocos.has(tag);
    if (bloco) flush();
    if (tag === 'LI') buffer += '• ';
    for (const child of node.childNodes ?? []) await visitar(child);
    if (['TD', 'TH'].includes(tag)) buffer += ' | ';
    if (bloco) flush(/^H[1-4]$/.test(tag), tag === 'H1' ? 14 : 11);
  };
  for (const node of document.body.childNodes) await visitar(node);
  flush();
  const logoResp = await fetch(LOGO);
  if (!logoResp.ok) throw new Error('Logo de assinatura indisponível');
  const logo = `data:image/jpeg;base64,${pdfBase64(new Uint8Array(await logoResp.arrayBuffer()))}`;
  const url = `https://senexcare.app/verificar-documento?id=${codigo}&hash=${env.hash_documento.toUpperCase()}`;
  const qr = await QRCode.toDataURL(url, { width: 260, margin: 1 });
  y += 8;
  for (const s of assinados) {
    if (y + 65 > 277) novaPagina();
    doc.setDrawColor(150).setLineWidth(0.25).line(16, y, 194, y);
    doc.addImage(logo, 'JPEG', 17, y + 2, 22, 22);
    const data = new Date(s.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(35);
    doc.text(doc.splitTextToSize(`Documento assinado eletronicamente por ${s.nome}, ${s.papel} em ${data}, conforme horário oficial de Brasília.`, 150), 43, y + 7);
    doc.line(16, y + 27, 194, y + 27);
    doc.addImage(qr, 'PNG', 17, y + 30, 25, 25);
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(`A autenticidade deste documento pode ser conferida no site ${url}, informando o código verificador ${codigo} e o código CRC/SHA-256 ${env.hash_documento.toUpperCase()}.`, 145), 47, y + 34, { lineHeightFactor: 1.25 });
    doc.link(47, y + 28, 145, 30, { url });
    doc.line(16, y + 60, 194, y + 60); y += 67;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

/** A versão final é persistida uma vez; download e anexo usam exatamente os mesmos bytes. */
export async function obterViaFinal(admin: any, envelopeId: string) {
  const { data: env, error } = await admin.from('assinatura_envelopes').select('*').eq('id', envelopeId).single();
  if (error || !env) throw new Error('Documento não encontrado');
  if (env.status !== 'concluido') throw new Error('A versão final estará disponível após todas as assinaturas');
  const filename = nomePdfAssinado(env.titulo);
  const { data: salvo, error: erroConsulta } = await admin.from('assinatura_pdfs_finais').select('*').eq('envelope_id', envelopeId).maybeSingle();
  if (erroConsulta) throw erroConsulta;
  if (salvo) {
    const { data: blob, error: erroArquivo } = await admin.storage.from(BUCKET).download(salvo.arquivo_path);
    if (erroArquivo || !blob) throw new Error('Via final armazenada indisponível');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (await hashBytes(bytes) !== salvo.hash_pdf) throw new Error('Integridade da via final inválida');
    return { bytes, filename, env };
  }
  const { data: lista, error: erroLista } = await admin.from('assinatura_signatarios').select('*').eq('envelope_id', envelopeId).order('ordem');
  if (erroLista || !lista?.length || lista.some((s: any) => s.status !== 'assinado')) throw new Error('Assinaturas incompletas');
  const { data: verificacao } = await admin.from('assinatura_verificacoes').select('codigo_verificador').eq('origem', 'envelope').eq('referencia_id', envelopeId).single();
  if (!verificacao) throw new Error('Código de verificação indisponível');
  const bytes = await renderizarViaAssinada(env, lista, verificacao.codigo_verificador);
  await PDFDocument.load(bytes); // Nunca armazenar/enviar um arquivo que não seja PDF válido.
  const path = `${envelopeId}/${crypto.randomUUID()}.pdf`;
  const { error: erroUpload } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (erroUpload) throw erroUpload;
  const { error: erroRegistro } = await admin.from('assinatura_pdfs_finais').insert({ envelope_id: envelopeId, arquivo_path: path, hash_pdf: await hashBytes(bytes) });
  if (erroRegistro) {
    await admin.storage.from(BUCKET).remove([path]);
    if (erroRegistro.code === '23505') return obterViaFinal(admin, envelopeId);
    throw erroRegistro;
  }
  return { bytes, filename, env };
}

export async function enviarViasFinais(admin: any, envelopeId: string) {
  const final = await obterViaFinal(admin, envelopeId);
  const { data: lista, error } = await admin.from('assinatura_signatarios').select('id,email,papel').eq('envelope_id', envelopeId).eq('status', 'assinado');
  if (error) throw error;
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('Envio de e-mail não configurado');
  let enviados = 0;
  for (const s of lista ?? []) {
    if (!s.email || s.papel === 'empresa') continue;
    const { data: anterior } = await admin.from('assinatura_eventos').select('id').eq('envelope_id', envelopeId).eq('signatario_id', s.id).eq('evento', 'pdf_final_enviado').limit(1);
    if (anterior?.length) { enviados++; continue; }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `assinatura-final-${envelopeId}-${s.id}` },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') || 'Senex Care <nao-responda@senexcare.app>', to: [s.email],
        subject: `Documento assinado — ${final.env.titulo}`,
        html: '<p>Todas as assinaturas foram concluídas. Segue em anexo a versão integral final assinada em PDF, com rodapé e verificação de autenticidade.</p>',
        attachments: [{ filename: final.filename, content: pdfBase64(final.bytes), content_type: 'application/pdf' }],
      }),
    });
    if (!res.ok) throw new Error(`Falha no envio do PDF final (${res.status})`);
    const resultado = await res.json();
    const { error: erroEvento } = await admin.from('assinatura_eventos').insert({ envelope_id: envelopeId, signatario_id: s.id, evento: 'pdf_final_enviado', metadata: { canal: 'email', provider_id: resultado.id, filename: final.filename } });
    if (erroEvento) throw erroEvento;
    enviados++;
  }
  return enviados;
}