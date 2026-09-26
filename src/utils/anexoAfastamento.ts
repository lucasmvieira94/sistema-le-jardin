import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import wasmAsset from '@/assets/soffice.wasm.asset.json';
import dataAsset from '@/assets/soffice.data.asset.json';

export const TIPOS_ANEXO = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.svg,.doc,.docx,.odt';
const MAX_BYTES = 20 * 1024 * 1024;
const EXTENSOES = new Set(TIPOS_ANEXO.split(',').map(tipo => tipo.slice(1)));
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

export async function converterAnexoParaPdf(file: File, onProgress?: (message: string) => void): Promise<Blob> {
  const ext = validarAnexo(file);
  if (ext === 'pdf') {
    const header = new TextDecoder().decode((await file.slice(0, 5).arrayBuffer()));
    if (header !== '%PDF-') throw new Error('O arquivo PDF é inválido.');
    return file;
  }
  if (!['doc', 'docx', 'odt'].includes(ext)) return imagemParaPdf(file, ext);

  if (!crossOriginIsolated) throw new Error('A conversão de Word requer uma conexão segura com isolamento entre sites. Tente abrir o aplicativo no domínio oficial.');
  onProgress?.('Preparando conversão do documento…');
  const { WorkerBrowserConverter } = await import('@matbee/libreoffice-converter/browser');
  const converter = new WorkerBrowserConverter({
    sofficeJs: '/office-wasm/soffice.js',
    sofficeWasm: wasmAsset.url,
    sofficeData: dataAsset.url,
    sofficeWorkerJs: '/office-wasm/soffice.worker.js',
    browserWorkerJs: '/office-wasm/browser.worker.global.js',
    onProgress: (progress) => onProgress?.(`Convertendo documento… ${progress.percent}%`),
  });
  try {
    await converter.initialize();
    const result = await converter.convert(await file.arrayBuffer(), { outputFormat: 'pdf', inputFormat: ext }, file.name);
    const blob = new Blob([new Uint8Array(result.data)], { type: 'application/pdf' });
    if (new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error('Falha na conversão do documento.');
    return blob;
  } finally {
    await converter.destroy();
  }
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
  const hashPdf = await hashArquivo(pdf);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Entre como gestor para anexar o documento.');
  const path = `${tenantId}/${afastamentoId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;
  try {
    const { error } = await supabase.from('afastamentos_anexos').insert({
      afastamento_id: afastamentoId, tenant_id: tenantId, criado_por: user.id,
      nome_original: file.name, formato_original: ext, tamanho_original: file.size,
      hash_original: hashOriginal, pdf_path: path, tamanho_pdf: pdf.size, hash_pdf: hashPdf,
    });
    if (error) throw error;
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function revogarAnexo(id: string): Promise<void> {
  const { error } = await supabase.from('afastamentos_anexos').update({ revogado_em: new Date().toISOString() }).eq('id', id).is('revogado_em', null);
  if (error) throw error;
}