/**
 * Geração do PDF do documento ASSINADO.
 *
 * Reúne, num único arquivo:
 *  1. o conteúdo original do documento (HTML do envelope);
 *  2. a página de assinaturas, com a rubrica de cada signatário e as
 *     evidências de autoria (data/hora UTC-3, IP, dispositivo, método e hash).
 *
 * Serve tanto ao painel administrativo quanto ao signatário externo (página
 * pública), garantindo que ambas as partes tenham a mesma via probatória —
 * MP 2.200-2/2001, art. 10, §2º e Lei 14.063/2020.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
}

const METODOS: Record<string, string> = {
  otp_email: 'Código por e-mail',
  otp_sms: 'Código por WhatsApp',
  biometria_facial: 'Biometria facial',
  rubrica_empresa: 'Rubrica institucional da empresa',
};

const fmt = (iso?: string | null) =>
  iso ? `${new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (UTC-3)` : '—';

const esc = (v?: string | null) =>
  String(v ?? '—').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/** Bloco HTML com as assinaturas e as evidências coletadas. */
export function blocoAssinaturasHTML(doc: DocumentoAssinadoInput): string {
  const linhas = doc.signatarios
    .map(
      (s) => `
      <div style="border:1px solid #d1d5db;border-radius:6px;padding:10px 12px;margin-bottom:10px">
        <div style="font-weight:bold;font-size:11pt">${esc(s.nome)} — ${esc(s.papel)}</div>
        ${
          s.rubrica_base64
            ? `<img src="${s.rubrica_base64}" style="max-height:60px;margin:6px 0" alt="Rubrica de ${esc(s.nome)}" />`
            : `<div style="font-family:'Times New Roman',serif;font-style:italic;font-size:16pt;margin:6px 0">${esc(s.nome)}</div>`
        }
        <div style="font-size:9pt;line-height:1.45">
          <div>CPF: ${esc(s.cpf)}</div>
          <div>Método de confirmação: ${esc(METODOS[s.metodo] ?? s.metodo)}</div>
          <div>Situação: ${s.status === 'assinado' ? 'Assinado' : s.status === 'recusado' ? 'Recusado' : 'Pendente'}</div>
          <div>Assinado em: ${fmt(s.assinado_em)}</div>
          <div>IP: ${esc(s.ip_origem)}</div>
          <div style="word-break:break-all">Dispositivo: ${esc(s.user_agent)}</div>
          <div style="word-break:break-all">Hash da assinatura: ${esc(s.hash_assinatura)}</div>
          ${s.motivo_recusa ? `<div>Motivo da recusa: ${esc(s.motivo_recusa)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('');

  return `
  <div style="margin-top:24px;padding-top:12px;border-top:2px solid #111">
    <h3 style="font-size:12pt;margin:0 0 10px">ASSINATURAS ELETRÔNICAS</h3>
    ${linhas}
    <div style="font-size:8.5pt;color:#374151;line-height:1.45;margin-top:8px;word-break:break-all">
      Hash SHA-256 do documento: ${esc(doc.hash_documento)}<br/>
      Documento assinado eletronicamente nos termos da MP 2.200-2/2001 (art. 10, §2º) e da Lei 14.063/2020.
      Qualquer alteração no conteúdo invalida o hash acima.
    </div>
  </div>`;
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

  // Evita que imagens/tabelas estourem a largura útil da página.
  const estilo = document.createElement('style');
  estilo.textContent = `
    .doc-pdf-root img { max-width:100%; height:auto; }
    .doc-pdf-root table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .doc-pdf-root td, .doc-pdf-root th { word-break:break-word; }
    .doc-pdf-root * { max-width:100%; }
  `;
  container.className = 'doc-pdf-root';
  container.appendChild(estilo);

  const corpo = document.createElement('div');
  corpo.innerHTML = doc.conteudo_html + blocoAssinaturasHTML(doc);
  container.appendChild(corpo);
  document.body.appendChild(container);

  try {
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
      const fim =
        fimIdeal >= canvas.height
          ? canvas.height
          : encontrarCorteSeguro(ctx, canvas.width, offset, fimIdeal, limiteBusca);
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
    pdf.save(`${nome}_assinado.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

