import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

export const TIPOS_ANEXO = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.svg,.docx,.odt,.txt,.rtf';
const MAX_BYTES = 20 * 1024 * 1024;
const EXTENSOES = new Set(TIPOS_ANEXO.split(',').map(tipo => tipo.slice(1)));
const EDITAVEIS = new Set(['docx', 'odt', 'txt', 'rtf']);
const BUCKET = 'afastamentos-documentos';

export interface AnexoAfastamento {
  id: string;
  afastamento_id: string;
  nome_original: string;
  hash_pdf: string;
  token: string;
  revogado_em: string | null;
  documento_id: string | null;
}

export function validarAnexo(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSOES.has(ext)) throw new Error('Formato não aceito. Use PDF, imagem, Word ou OpenDocument.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('O arquivo deve ter até 20 MB.');
  return ext;
}

export async function hashArquivo(data: Blob | ArrayBuffer): Promise<string> {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function imagemParaPdf(file: File, ext: string): Promise<Blob> {
  let origem: Blob = file;
  if (ext === 'heic' || ext === 'heif') {
    const { default: heic2any } = await import('heic2any');
    const resultado = await heic2any({ blob: file, toType: 'image/png' });
    origem = Array.isArray(resultado) ? resultado[0] : resultado;
  }
  if (ext === 'tif' || ext === 'tiff') {
    const UTIF = await import('utif');
    const buffer = await file.arrayBuffer();
    const pages = UTIF.decode(buffer);
    if (!pages.length) throw new Error('Imagem TIFF inválida.');
    const pdf = new jsPDF();
    pages.forEach((page, index) => {
      UTIF.decodeImage(buffer, page);
      const rgba = UTIF.toRGBA8(page);
      const canvas = document.createElement('canvas');
      canvas.width = page.width;
      canvas.height = page.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a imagem.');
      context.putImageData(new ImageData(new Uint8ClampedArray(rgba), page.width, page.height), 0, 0);
      if (index) pdf.addPage();
      const w = pdf.internal.pageSize.getWidth();
      const h = Math.min((page.height / page.width) * (w - 20), pdf.internal.pageSize.getHeight() - 20);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, w - 20, h);
    });
    return pdf.output('blob');
  }
  // SVG is rasterized without injecting its markup into the DOM; scripts/external assets cannot be embedded in a PDF.
  if (ext === 'svg') {
    const markup = await file.text();
    if (/<script|<foreignObject|(?:href|url\()\s*=?.*?(?:https?:|data:|javascript:)/i.test(markup)) {
      throw new Error('SVG com conteúdo externo ou executável não é permitido.');
    }
    origem = new Blob([markup], { type: 'image/svg+xml' });
  }
  const url = URL.createObjectURL(origem);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const factor = Math.min(1, 3000 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível processar a imagem.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pdf = new jsPDF(canvas.width > canvas.height ? 'landscape' : 'portrait');
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const scale = Math.min((w - 20) / canvas.width, (h - 20) / canvas.height);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (w - canvas.width * scale) / 2, (h - canvas.height * scale) / 2, canvas.width * scale, canvas.height * scale);
    return pdf.output('blob');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Extracts the readable text of editable documents without executing embedded content. */
export async function textoDoDocumento(file: File, ext: string): Promise<string> {
  if (ext === 'txt') return (await file.text()).trim();
  if (ext === 'rtf') {
    // Minimal RTF reading: drop control words and groups, keep visible text.
    const bruto = await file.text();
    return bruto.replace(/\\'[0-9a-f]{2}/gi, ' ').replace(/\\[a-z]+-?\d* ?/gi, ' ').replace(/[{}]/g, '').replace(/[ \t]+/g, ' ').trim();
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value.trim();
  }
  const { unzipSync, strFromU8 } = await import('fflate');
  const arquivos = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const conteudo = arquivos['content.xml'];
  if (!conteudo) throw new Error('Arquivo OpenDocument inválido.');
  return strFromU8(conteudo)
    .replace(/<text:(p|h)[^>]*>/g, '\n')
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .trim();
}

/** Renders extracted text as an A4 PDF preserving paragraphs and page breaks. */
export function textoParaPdf(texto: string, titulo: string): Blob {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = pdf.internal.pageSize.getWidth() - 30;
  const alturaMax = pdf.internal.pageSize.getHeight() - 20;
  pdf.setFont('helvetica', 'bold').setFontSize(12);
  pdf.text(pdf.splitTextToSize(titulo, largura), 15, 18);
  pdf.setFont('helvetica', 'normal').setFontSize(11);
  let y = 30;
  for (const paragrafo of texto.split(/\n+/)) {
    for (const linha of pdf.splitTextToSize(paragrafo.trim() || ' ', largura)) {
      if (y > alturaMax) { pdf.addPage(); y = 20; }
      pdf.text(linha, 15, y);
      y += 6;
    }
    y += 2;
  }
  return pdf.output('blob');
}

export async function converterAnexoParaPdf(file: File, onProgress?: (message: string) => void): Promise<Blob> {
  const ext = validarAnexo(file);
  if (ext === 'pdf') {
    const header = new TextDecoder().decode((await file.slice(0, 5).arrayBuffer()));
    if (header !== '%PDF-') throw new Error('O arquivo PDF é inválido.');
    return file;
  }
  if (!EDITAVEIS.has(ext)) {
    onProgress?.('Convertendo imagem para PDF…');
    return imagemParaPdf(file, ext);
  }
  onProgress?.('Lendo o documento…');
  const texto = await textoDoDocumento(file, ext);
  if (!texto) throw new Error('O documento está vazio ou não pôde ser lido. Salve-o como PDF e envie novamente.');
  onProgress?.('Gerando PDF…');
  return textoParaPdf(texto, file.name.replace(/\.[^.]+$/, ''));
}

export function linkAnexo(token: string): string {
  return `${window.location.origin}/anexo-afastamento/${encodeURIComponent(token)}`;
}

/** Upload and registration are compensating operations: an error removes the private PDF. */
export async function registrarAnexoAfastamento(file: File, afastamentoId: string, tenantId: string, onProgress?: (message: string) => void): Promise<void> {
  const ext = validarAnexo(file);
  const hashOriginal = await hashArquivo(file);
  const pdf = await converterAnexoParaPdf(file, onProgress);
  if (pdf.size > MAX_BYTES) throw new Error('O PDF convertido excede o limite de 20 MB.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Entre como gestor para anexar o documento.');
  const path = `${tenantId}/${afastamentoId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;
  try {
    const { error, data } = await supabase.functions.invoke('registrar-anexo-afastamento', {
      body: { afastamentoId, tenantId, path, nomeOriginal: file.name,
        formatoOriginal: ext, tamanhoOriginal: file.size, hashOriginal },
    });
    if (error || !data?.id) throw error ?? new Error('Não foi possível autenticar o PDF.');
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function revogarAnexo(id: string): Promise<void> {
  const { error } = await supabase.from('afastamentos_anexos').update({ revogado_em: new Date().toISOString() }).eq('id', id).is('revogado_em', null);
  if (error) throw error;
}