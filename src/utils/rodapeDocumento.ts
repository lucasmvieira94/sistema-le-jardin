import type jsPDF from 'jspdf';

export interface SeloAutenticidade {
  id: string;
  hash: string;
  urlVerificacao: string;
  qrDataUrl: string;
}

const escapeHtml = (valor: string) => valor.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] ?? c));

/** Apresentação institucional inspirada no SEI, sem usar sua marca nem afirmar assinatura inexistente. */
export function rodapeDocumentoHTML(auth: SeloAutenticidade): string {
  const url = escapeHtml(auth.urlVerificacao);
  return `<div class="autenticidade" style="margin-top:22px;break-inside:avoid;page-break-inside:avoid;font-family:Arial,sans-serif;font-size:9pt;color:#222;border-top:1px solid #999;border-bottom:1px solid #999;">
    <div style="padding:8px 4px;border-bottom:1px solid #ddd;line-height:1.4"><strong>DOCUMENTO ELETRÔNICO · AUTENTICIDADE</strong><br/>Confira a integridade deste documento pelo código e QR Code abaixo.</div>
    <div style="display:flex;align-items:center;gap:12px;padding:8px 4px;min-width:0;">
      <img src="${escapeHtml(auth.qrDataUrl)}" alt="QR Code de verificação" style="width:76px;height:76px;flex:none" />
      <div style="min-width:0;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">
        A autenticidade pode ser conferida em <a href="${url}">${url}</a><br/>
        <strong>Código verificador:</strong> ${escapeHtml(auth.id)}<br/>
        <strong>Hash SHA-256:</strong> ${escapeHtml(auth.hash)}
      </div>
    </div>
  </div>`;
}

/** Faixa de verificação no fim do PDF; reserva de 36 mm a cargo do chamador. */
export function renderRodapeDocumentoPDF(doc: jsPDF, auth: SeloAutenticidade, margin = 18): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - 54;
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  doc.line(margin, y, w - margin, y);
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(35);
  doc.text('DOCUMENTO ELETRÔNICO · AUTENTICIDADE', margin + 2, y + 5);
  doc.line(margin, y + 8, w - margin, y + 8);
  doc.addImage(auth.qrDataUrl, 'PNG', margin + 2, y + 10, 25, 25);
  const x = margin + 31;
  const disponivel = w - margin - x - 2;
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(45);
  doc.text('Confira a autenticidade em:', x, y + 13);
  doc.text(doc.splitTextToSize(auth.urlVerificacao, disponivel), x, y + 17);
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text(doc.splitTextToSize(`Código verificador: ${auth.id}`, disponivel), x, y + 26);
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  doc.text(doc.splitTextToSize(`SHA-256: ${auth.hash}`, disponivel), x, y + 31);
  doc.line(margin, y + 37, w - margin, y + 37);
  doc.setTextColor(0);
}