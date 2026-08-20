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

/** Renderiza o documento + assinaturas e dispara o download do PDF. */
export async function gerarPdfDocumentoAssinado(doc: DocumentoAssinadoInput): Promise<void> {
  const marginX = 15;
  const marginY = 12;
  const contentWidthMm = 210 - marginX * 2;

  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:-9999px;top:0;width:${contentWidthMm}mm;background:#fff;color:#000;font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.5`;
  container.innerHTML = doc.conteudo_html + blocoAssinaturasHTML(doc);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.scrollWidth,
      height: container.scrollHeight,
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
    const renderHeight = (canvas.height * renderWidth) / canvas.width;
    const usableHeight = pdfHeight - marginY * 2;
    const imgData = canvas.toDataURL('image/png');

    let position = 0;
    let page = 0;
    while (position < renderHeight) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', marginX, marginY - position, renderWidth, renderHeight);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, marginY, 'F');
      pdf.rect(0, pdfHeight - marginY, pdfWidth, marginY, 'F');
      position += usableHeight;
      page++;
    }

    const nome = doc.titulo.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'documento';
    pdf.save(`${nome}_assinado.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
