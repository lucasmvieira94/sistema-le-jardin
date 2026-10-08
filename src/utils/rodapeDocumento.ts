import type jsPDF from 'jspdf';
import sxCareLogo from '@/assets/sxcare-assinatura-eletronica.jpg.asset.json';

export interface SeloAutenticidade {
  id: string;
  hash: string;
  urlVerificacao: string;
  qrDataUrl: string;
}

export interface RegistroAssinaturaDocumento {
  nome: string;
  papel?: string | null;
  metodo?: string | null;
  assinadoEm: string;
}

const escapeHtml = (valor: string) => valor.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] ?? c));

export const normalizarHashDocumento = (hash: string) => hash.trim().toUpperCase();

export const codigoVerificadorDoHash = (hash: string): string => {
  const normalizado = normalizarHashDocumento(hash);
  const trecho = normalizado.slice(0, 13);
  const numero = Number.parseInt(trecho || '0', 16);
  return String(10_000_000 + (Number.isFinite(numero) ? numero % 90_000_000 : 0));
};

export const formatarDataHoraAssinatura = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(', ', ' às ');

const iconeSenexCareHTML = () => `
  <img src="${escapeHtml(sxCareLogo.url)}" alt="SXCare assinatura eletrônica" style="width:66px;height:66px;flex:none;border:1px solid #777;border-radius:4px;object-fit:cover;background:#fff" />`;

/** Apresentação institucional inspirada no SEI, sem usar sua marca nem afirmar assinatura inexistente. */
export function rodapeDocumentoHTML(
  auth: SeloAutenticidade,
  assinatura?: RegistroAssinaturaDocumento | null,
): string {
  const url = escapeHtml(auth.urlVerificacao);
  const faixaAssinatura = assinatura
    ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #999;line-height:1.45;">
        ${iconeSenexCareHTML()}
        <div style="min-width:0">Documento assinado eletronicamente por <strong>${escapeHtml(assinatura.nome)}</strong>${assinatura.papel ? `, ${escapeHtml(assinatura.papel)}` : ''} em ${escapeHtml(formatarDataHoraAssinatura(assinatura.assinadoEm))}, conforme horário oficial de Brasília.</div>
      </div>`
    : `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #999;line-height:1.4;">
        ${iconeSenexCareHTML()}
        <div><strong>DOCUMENTO ELETRÔNICO · AUTENTICIDADE</strong><br/>Este bloco comprova a integridade do documento; não representa assinatura eletrônica.</div>
      </div>`;
  return `<div class="autenticidade" style="margin-top:22px;break-inside:avoid;page-break-inside:avoid;font-family:Arial,sans-serif;font-size:9pt;text-align:left;color:#222;border-top:1px solid #999;border-bottom:1px solid #999;">
    ${faixaAssinatura}
    <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;min-width:0;">
      <img src="${escapeHtml(auth.qrDataUrl)}" alt="QR Code de verificação" style="width:76px;height:76px;flex:none" />
      <div style="min-width:0;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">
        A autenticidade deste documento pode ser conferida no site <a href="${url}">${url}</a>, informando o código verificador <strong>${escapeHtml(auth.id)}</strong> e o código CRC/SHA-256 <strong>${escapeHtml(normalizarHashDocumento(auth.hash))}</strong>.
      </div>
    </div>
  </div>`;
}

/** Faixa de verificação no fim do PDF; reserva de 36 mm a cargo do chamador. */
export function renderRodapeDocumentoPDF(
  doc: jsPDF,
  auth: SeloAutenticidade,
  margin = 18,
  assinatura?: RegistroAssinaturaDocumento | null,
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - 65;
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  doc.line(margin, y, w - margin, y);
  // Símbolo vetorial SXCare (blocos conectados + cadeado) para impressão nítida.
  doc.setFillColor(19, 102, 63);
  doc.roundedRect(margin + 2, y + 3, 24, 16, 1, 1, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 5, y + 8, 3.2, 3.2, 'F');
  doc.rect(margin + 9, y + 8, 3.2, 3.2, 'F');
  doc.rect(margin + 7, y + 12, 3.2, 3.2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(margin + 14, y + 10, 6, 5.5, 0.7, 0.7);
  doc.line(margin + 15.2, y + 10, margin + 15.2, y + 8.5);
  doc.line(margin + 18.8, y + 10, margin + 18.8, y + 8.5);
  doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(255, 255, 255);
  doc.text('SXCare', margin + 14, y + 7.2);
  doc.setFont('helvetica', assinatura ? 'normal' : 'bold').setFontSize(7.3).setTextColor(35);
  const textoAssinatura = assinatura
    ? `Documento assinado eletronicamente por ${assinatura.nome}${assinatura.papel ? `, ${assinatura.papel}` : ''} em ${formatarDataHoraAssinatura(assinatura.assinadoEm)}, conforme horário oficial de Brasília.`
    : 'DOCUMENTO ELETRÔNICO · AUTENTICIDADE — este bloco comprova integridade e não representa assinatura.';
  doc.text(doc.splitTextToSize(textoAssinatura, w - margin * 2 - 31), margin + 30, y + 8);
  doc.line(margin, y + 22, w - margin, y + 22);
  doc.addImage(auth.qrDataUrl, 'PNG', margin + 2, y + 25, 25, 25);
  const x = margin + 31;
  const disponivel = w - margin - x - 2;
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(45);
  doc.text('A autenticidade deste documento pode ser conferida no site:', x, y + 29);
  doc.text(doc.splitTextToSize(auth.urlVerificacao, disponivel), x, y + 33);
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text(doc.splitTextToSize(`Código verificador: ${auth.id}`, disponivel), x, y + 42);
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  doc.text(doc.splitTextToSize(`Código CRC/SHA-256: ${normalizarHashDocumento(auth.hash)}`, disponivel), x, y + 47);
  doc.line(margin, y + 53, w - margin, y + 53);
  doc.setTextColor(0);
}