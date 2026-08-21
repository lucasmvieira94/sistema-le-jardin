/**
 * Converte um arquivo PDF anexado em HTML de páginas (imagens JPEG embutidas),
 * permitindo que documentos externos entrem no fluxo de assinatura eletrônica
 * já existente (hash SHA-256, rubricas, PDF assinado e e-mail ao signatário).
 */
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - worker importado como URL pelo Vite
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = PdfWorker;

export const MAX_PAGINAS_PDF = 30;

export interface PdfConvertido {
  /** HTML pronto para o envelope (uma imagem por página). */
  html: string;
  paginas: number;
}

/**
 * Renderiza cada página do PDF em uma imagem e monta o HTML do documento.
 * @param file arquivo PDF selecionado pelo usuário
 * @param onProgresso callback opcional (página atual, total)
 */
export async function pdfParaHtml(
  file: File,
  onProgresso?: (pagina: number, total: number) => void,
): Promise<PdfConvertido> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const doc = await (pdfjsLib as any).getDocument({ data: buffer }).promise;
  const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
  const partes: string[] = [];

  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    // Escala 1.6 equilibra legibilidade e tamanho final do HTML armazenado.
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    partes.push(
      `<div class="pagina-pdf" style="page-break-after:always;margin:0 0 16px 0;">` +
        `<img src="${canvas.toDataURL('image/jpeg', 0.72)}" alt="Página ${n} do documento" ` +
        `style="width:100%;display:block;" /></div>`,
    );
    onProgresso?.(n, total);
  }

  await doc.destroy?.();

  return {
    html: `<div class="documento-pdf-anexado">${partes.join('')}</div>`,
    paginas: total,
  };
}
