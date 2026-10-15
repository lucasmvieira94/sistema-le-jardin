import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { carregarLogoRodape, renderRodapeDocumentoPDF, type SeloAutenticidade } from './rodapeDocumento';

export interface EmissaoPDF {
  tipo: 'folha_ponto' | 'relatorio' | 'ficha_acolhimento' | 'ficha_funcional';
  titulo: string;
  referenciaId?: string;
  referenciaTabela?: string;
  tenantId?: string;
}

export async function seloDaEmissao(data: { codigo_verificador?: unknown; hash?: unknown }): Promise<SeloAutenticidade> {
  const id = String(data.codigo_verificador ?? '');
  const hash = String(data.hash ?? '').trim().toUpperCase();
  if (!/^\d{8}$/.test(id) || !/^[A-F0-9]{64}$/.test(hash)) {
    throw new Error('Certificado de autenticidade inválido. Nenhum documento será emitido sem certificação.');
  }
  const urlVerificacao = `https://senexcare.app/verificar-documento?id=${id}&hash=${hash}`;
  const qrDataUrl = await QRCode.toDataURL(urlVerificacao, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
  return { id, hash, urlVerificacao, qrDataUrl };
}

/** Certifica os bytes do conteúdo antes do selo, que não pode fazer parte do próprio hash. */
export async function certificarPDF(doc: jsPDF, emissao: EmissaoPDF, fimConteudo?: number): Promise<SeloAutenticidade> {
  const bytes = doc.output('arraybuffer');
  const selo = await registrarSeloPDF(bytes, emissao, doc.getNumberOfPages());
  await carregarLogoRodape();
  doc.setPage(doc.getNumberOfPages());
  // Quando não há posição segura conhecida, preservar integralmente o corpo em uma página anterior.
  if (fimConteudo === undefined || fimConteudo > doc.internal.pageSize.getHeight() - 78) doc.addPage();
  renderRodapeDocumentoPDF(doc, selo, 16);
  return selo;
}

/** Certifica também PDFs distribuídos pelo sistema sem modificar as páginas importadas. */
export async function certificarArquivoPDF(bytes: Uint8Array, emissao: EmissaoPDF): Promise<Uint8Array> {
  const original = await PDFDocument.load(bytes);
  const selo = await registrarSeloPDF(bytes, emissao, original.getPageCount());
  await carregarLogoRodape();
  const footer = new jsPDF();
  renderRodapeDocumentoPDF(footer, selo, 16);
  const rodape = await PDFDocument.load(footer.output('arraybuffer'));
  const paginas = await original.copyPages(rodape, rodape.getPageIndices());
  paginas.forEach(pagina => original.addPage(pagina));
  return original.save();
}

async function registrarSeloPDF(bytes: ArrayBuffer | Uint8Array, emissao: EmissaoPDF, paginas: number): Promise<SeloAutenticidade> {
  const digest = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? new Uint8Array(bytes).buffer : bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const { data, error } = await supabase.functions.invoke('registrar-documento', {
    body: {
      tipo: emissao.tipo,
      referencia_id: emissao.referenciaId ?? null,
      referencia_tabela: emissao.referenciaTabela ?? null,
      tenant_id: emissao.tenantId ?? null,
      titular_nome: emissao.titulo,
      hash_conteudo: hash,
      dados_estruturais: { titulo: emissao.titulo, paginas, hash_conteudo: hash, escopo_hash: 'PDF antes do rodapé de certificação' },
    },
  });
  if (error || !data) throw new Error('Não foi possível certificar o documento. Tente emitir novamente.');
  return seloDaEmissao(data);
}