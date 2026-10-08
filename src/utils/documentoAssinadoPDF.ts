/**
 * Geração do PDF do documento ASSINADO.
 *
 * Reúne, num único arquivo:
 *  1. o conteúdo original do documento (HTML do envelope);
 *  2. o rodapé SXCare com signatário, horário e verificação pública.
 * Evidências de autoria permanecem na consulta online, não na via impressa.
 *
 * Serve tanto ao painel administrativo quanto ao signatário externo (página
 * pública), garantindo que ambas as partes tenham a mesma via probatória —
 * MP 2.200-2/2001, art. 10, §2º e Lei 14.063/2020.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';
import { PDFDocument } from 'pdf-lib';
import { normalizarHashDocumento, rodapeDocumentoHTML } from './rodapeDocumento';

export interface SignatarioPdf {
  nome: string;
  papel: string;
  metodo: string;
  status: string;
  cpf?: string | null;
  assinado_em?: string | null;
  ip_origem?: string | null;
  user_agent?: string | null;
  hash_assinatura?: string | null;
  rubrica_base64?: string | null;
  motivo_recusa?: string | null;
}

export interface DocumentoAssinadoInput {
  titulo: string;
  tipo?: string;
  conteudo_html: string;
  hash_documento: string;
  signatarios: SignatarioPdf[];
  url_verificacao?: string | null;
  codigo_verificador?: string;
  /** Bytes do PDF que foi efetivamente lido e assinado. Todas as páginas são preservadas. */
  arquivo_original?: ArrayBuffer;
}

/** Somente assinaturas efetivas são impressas; evidências permanecem na consulta online. */
export function assinaturasEfetivas(doc: DocumentoAssinadoInput): SignatarioPdf[] {
  return doc.signatarios.filter((s) => s.status === 'assinado' && Boolean(s.assinado_em));
}

export function validarDocumentoParaDownload(doc: DocumentoAssinadoInput): void {
  if (!doc.arquivo_original && !doc.conteudo_html.trim()) throw new Error('Conteúdo original indisponível.');
  if (!doc.url_verificacao || !/^\d{8}$/.test(doc.codigo_verificador ?? '')) {
    throw new Error('Código e link de autenticidade indisponíveis. Tente novamente.');
  }
  if (!assinaturasEfetivas(doc).length) throw new Error('Nenhuma assinatura registrada para este documento.');
}

/** Mesmo rodapé de duas faixas para cada assinatura real, sem manifesto no PDF. */
export function blocoAssinaturasHTML(doc: DocumentoAssinadoInput, qrDataUrl: string): string {
  return assinaturasEfetivas(doc).map((s) => rodapeDocumentoHTML({
    id: doc.codigo_verificador ?? '', hash: normalizarHashDocumento(doc.hash_documento),
    urlVerificacao: doc.url_verificacao ?? '', qrDataUrl,
  }, { nome: s.nome, papel: s.papel, assinadoEm: s.assinado_em ?? '' })).join('');
}

/** Anexa o rodapé ao PDF sem rasterizar, omitir ou reescrever páginas originais. */
export async function juntarOriginalERodape(original: ArrayBuffer, rodape: ArrayBuffer): Promise<Uint8Array> {
  const destino = await PDFDocument.load(original);
  const assinatura = await PDFDocument.load(rodape);
  const paginas = await destino.copyPages(assinatura, assinatura.getPageIndices());
  paginas.forEach((pagina) => destino.addPage(pagina));
  return destino.save();
}

/**
 * Localiza, de baixo para cima, a última linha "em branco" do canvas dentro da
 * faixa desejada — evita cortar texto ao meio na quebra de página, aproximando
 * o resultado do PDF gerado pelo diálogo de impressão do navegador.
 */
function encontrarCorteSeguro(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  inicio: number,
  fimIdeal: number,
  limiteBusca: number,
): number {
  const minimo = Math.max(inicio + 1, fimIdeal - limiteBusca);
  for (let y = fimIdeal; y > minimo; y--) {
    const { data } = ctx.getImageData(0, y, canvasWidth, 1);
    let limpa = true;
    for (let i = 0; i < data.length; i += 4) {
      // considera "branco" tudo acima de 246 nos três canais (antialias incluso)
      if (data[i] < 246 || data[i + 1] < 246 || data[i + 2] < 246) {
        limpa = false;
        break;
      }
    }
    if (limpa) return y;
  }
  return fimIdeal;
}

/** Renderiza o documento + assinaturas e dispara o download do PDF. */
export async function gerarPdfDocumentoAssinado(doc: DocumentoAssinadoInput): Promise<void> {
  validarDocumentoParaDownload(doc);
  if (doc.arquivo_original) {
    const digest = await crypto.subtle.digest('SHA-256', doc.arquivo_original);
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (hash !== normalizarHashDocumento(doc.hash_documento)) throw new Error('O arquivo atual difere do documento assinado. Download interrompido.');
  }
  // Margens equivalentes às do diálogo de impressão (padrão "normal").
  const marginX = 16;
  const marginTop = 16;
  const marginBottom = 18;
  const contentWidthMm = 210 - marginX * 2;

  const container = document.createElement('div');
  container.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    `width:${contentWidthMm}mm`,
    'background:#fff',
    'color:#000',
    "font-family:'Times New Roman',Times,serif",
    'font-size:11pt',
    'line-height:1.5',
    'text-align:justify',
  ].join(';');

  // Replica o CSS usado na janela de impressão dos documentos do sistema,
  // para que títulos, subtítulos, caixas e assinaturas mantenham a hierarquia
  // visual original (o innerHTML capturado depende dessas classes).
  const estilo = document.createElement('style');
  estilo.textContent = `
    .doc-pdf-root img { max-width:100%; height:auto; }
    .doc-pdf-root table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .doc-pdf-root td, .doc-pdf-root th { word-break:break-word; }

    .doc-pdf-root p { margin:0 0 6px; }
    .doc-pdf-root strong, .doc-pdf-root b { font-weight:bold; }

    /* Títulos genéricos */
    .doc-pdf-root h1 { font-size:15.6pt; font-weight:bold; text-align:center; letter-spacing:1px; margin:0 0 4px; }
    .doc-pdf-root h2 { font-size:12.5pt; font-weight:normal; text-align:center; color:#333; margin:0 0 6px; }
    .doc-pdf-root h3 { font-size:12.5pt; font-weight:bold; text-align:left; margin:10px 0 4px; }
    .doc-pdf-root h4 { font-size:11.5pt; font-weight:bold; text-align:left; margin:8px 0 4px; }

    /* Cabeçalho institucional */
    .doc-pdf-root .header { text-align:center; margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:6px; }
    .doc-pdf-root .header img { max-height:50px; margin:0 auto 6px; display:block; }

    /* Tipo/título do documento */
    .doc-pdf-root .tipo-doc,
    .doc-pdf-root .titulo-contrato {
      text-align:center; font-size:14pt; font-weight:bold; margin:10px 0;
      text-decoration:underline; letter-spacing:1px;
    }
    .doc-pdf-root .subtitulo, .doc-pdf-root .clausula-titulo {
      font-weight:bold; text-align:left; margin:10px 0 4px; text-decoration:none;
    }

    /* Caixas de dados */
    .doc-pdf-root .info-box { border:1px solid #333; padding:8px 12px; margin:8px 0; }
    .doc-pdf-root .info-row { display:flex; margin-bottom:3px; }
    .doc-pdf-root .info-label { font-weight:bold; min-width:170px; }
    .doc-pdf-root .info-value { flex:1; }
    .doc-pdf-root .suspensao-box { border:1px solid #333; padding:8px; margin:8px 0; background:#f9f9f9; }
    .doc-pdf-root .recusa-box { border:1px dashed #666; padding:6px; margin:8px 0; font-size:10.5pt; }
    .doc-pdf-root .hash-box { margin-top:12px; padding:6px; border:1px solid #ccc; font-size:8.4pt; color:#555; text-align:center; word-break:break-all; }

    /* Blocos de texto */
    .doc-pdf-root .descricao { margin:10px 0; text-align:justify; }
    .doc-pdf-root .descricao p { text-indent:2em; }
    .doc-pdf-root .legal-text { margin:12px 0; font-size:10.5pt; text-align:justify; border-top:1px solid #ccc; padding-top:8px; }
    .doc-pdf-root .data-local { text-align:right; margin:12px 0; font-size:11.5pt; }

    /* Assinaturas do documento original */
    .doc-pdf-root .assinaturas { margin-top:26px; }
    .doc-pdf-root .assinatura-row { display:flex; justify-content:space-between; margin-bottom:26px; }
    .doc-pdf-root .assinatura-item { text-align:center; width:46%; }
    .doc-pdf-root .assinatura-linha { border-top:1px solid #000; padding-top:3px; margin-top:26px; font-size:10.5pt; text-align:center; }
    .doc-pdf-root .assinatura-linha p { margin:0; text-indent:0; }
  `;

  container.className = 'doc-pdf-root';
  container.appendChild(estilo);

  const qrDataUrl = await QRCode.toDataURL(doc.url_verificacao ?? '', {
    width: 180, margin: 1, errorCorrectionLevel: 'M',
  });
  const corpo = document.createElement('div');
  corpo.innerHTML = (doc.arquivo_original ? '' : DOMPurify.sanitize(doc.conteudo_html)) + blocoAssinaturasHTML(doc, qrDataUrl);
  container.appendChild(corpo);
  document.body.appendChild(container);

  try {
    await Promise.all(Array.from(container.querySelectorAll('img')).map(async (img) => {
      try { await img.decode(); } catch { throw new Error('Não foi possível carregar as imagens do documento. Tente novamente.'); }
    }));
    const blocos = Array.from(container.querySelectorAll('.autenticidade')).map((el) => {
      const r = el.getBoundingClientRect();
      const root = container.getBoundingClientRect();
      return { inicio: r.top - root.top, fim: r.bottom - root.top };
    });
    const canvas = await html2canvas(container, {
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.scrollWidth,
      height: container.scrollHeight,
      windowWidth: container.scrollWidth,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setDocumentProperties({
      title: doc.titulo,
      subject: 'Documento assinado eletronicamente',
      creator: 'Senex Care',
      keywords: `assinatura,hash:${doc.hash_documento}`,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const renderWidth = pdfWidth - marginX * 2;
    const usableHeightMm = pdfHeight - marginTop - marginBottom;

    // px do canvas por mm impresso
    const pxPorMm = canvas.width / renderWidth;
    const alturaPaginaPx = Math.floor(usableHeightMm * pxPorMm);
    // até ~12% da página pode ser "cedida" para achar uma quebra limpa
    const limiteBusca = Math.floor(alturaPaginaPx * 0.12);

    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

    let offset = 0;
    let pagina = 0;
    while (offset < canvas.height) {
      const fimIdeal = Math.min(offset + alturaPaginaPx, canvas.height);
      let fim =
        fimIdeal >= canvas.height
          ? canvas.height
          : encontrarCorteSeguro(ctx, canvas.width, offset, fimIdeal, limiteBusca);
      const escala = canvas.width / container.scrollWidth;
      for (const bloco of blocos) {
        const inicioBloco = Math.floor(bloco.inicio * escala);
        const fimBloco = Math.ceil(bloco.fim * escala);
        if (inicioBloco > offset && inicioBloco < fim && fimBloco > fim) fim = inicioBloco;
      }
      const alturaFatiaPx = fim - offset;
      if (alturaFatiaPx <= 0) break;

      const fatia = document.createElement('canvas');
      fatia.width = canvas.width;
      fatia.height = alturaFatiaPx;
      const fatiaCtx = fatia.getContext('2d') as CanvasRenderingContext2D;
      fatiaCtx.fillStyle = '#ffffff';
      fatiaCtx.fillRect(0, 0, fatia.width, fatia.height);
      fatiaCtx.drawImage(canvas, 0, offset, canvas.width, alturaFatiaPx, 0, 0, canvas.width, alturaFatiaPx);

      if (pagina > 0) pdf.addPage();
      pdf.addImage(
        fatia.toDataURL('image/jpeg', 0.95),
        'JPEG',
        marginX,
        marginTop,
        renderWidth,
        alturaFatiaPx / pxPorMm,
        undefined,
        'FAST',
      );

      offset = fim;
      pagina++;
    }

    // Numeração de páginas no rodapé (dentro da margem inferior).
    const total = pdf.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(110);
      pdf.text(`Página ${p} de ${total}`, pdfWidth / 2, pdfHeight - 8, { align: 'center' });
    }

    const nome = doc.titulo.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'documento';
    if (doc.arquivo_original) {
      const bytes = await juntarOriginalERodape(doc.arquivo_original, pdf.output('arraybuffer'));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${nome}_assinado.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      pdf.save(`${nome}_assinado.pdf`);
    }
  } finally {
    document.body.removeChild(container);
  }
}

