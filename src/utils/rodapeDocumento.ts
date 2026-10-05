import type jsPDF from 'jspdf';

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

const formatarAssinatura = (iso: string) =>
  `${new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário oficial de Brasília)`;

const iconeSenexCareHTML = () => `
  <div aria-label="SenexCare assinatura eletrônica" style="width:76px;height:58px;flex:none;border:1px solid #777;border-radius:4px;display:flex;align-items:center;justify-content:center;gap:5px;background:#fff;color:#222;">
    <svg viewBox="0 0 28 34" width="23" height="29" aria-hidden="true">
      <path d="M4 1.5h13l7 7V32H4z" fill="none" stroke="currentColor" stroke-width="1.7"/>
      <path d="M17 1.5v7h7M9 15h10M9 20h7" fill="none" stroke="currentColor" stroke-width="1.7"/>
      <rect x="14" y="23" width="10" height="8" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.5"/>
      <path d="M17 23v-2a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    <div style="line-height:1.05;text-align:left"><strong style="font-size:10px">SenexCare</strong><br/><span style="font-size:7px">assinatura<br/>eletrônica</span></div>
  </div>`;

/** Apresentação institucional inspirada no SEI, sem usar sua marca nem afirmar assinatura inexistente. */
export function rodapeDocumentoHTML(
  auth: SeloAutenticidade,
  assinatura?: RegistroAssinaturaDocumento | null,
): string {
  const url = escapeHtml(auth.urlVerificacao);
  const faixaAssinatura = assinatura
    ? `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #999;line-height:1.45;">
        ${iconeSenexCareHTML()}
        <div>Documento assinado eletronicamente por <strong>${escapeHtml(assinatura.nome)}</strong>${assinatura.papel ? `, ${escapeHtml(assinatura.papel)}` : ''} em ${escapeHtml(formatarAssinatura(assinatura.assinadoEm))}.${assinatura.metodo ? `<br/><span style="font-size:8pt">Método de confirmação: ${escapeHtml(assinatura.metodo)}.</span>` : ''}</div>
      </div>`
    : `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid #999;line-height:1.4;">
        ${iconeSenexCareHTML()}
        <div><strong>DOCUMENTO ELETRÔNICO · AUTENTICIDADE</strong><br/>Este bloco comprova a integridade do documento; não representa assinatura eletrônica.</div>
      </div>`;
  return `<div class="autenticidade" style="margin-top:22px;break-inside:avoid;page-break-inside:avoid;font-family:Arial,sans-serif;font-size:9pt;color:#222;border-top:1px solid #999;border-bottom:1px solid #999;">
    ${faixaAssinatura}
    <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;min-width:0;">
      <img src="${escapeHtml(auth.qrDataUrl)}" alt="QR Code de verificação" style="width:76px;height:76px;flex:none" />
      <div style="min-width:0;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">
        A autenticidade deste documento pode ser conferida em <a href="${url}">${url}</a>, informando os códigos abaixo.<br/>
        <strong>Código verificador:</strong> ${escapeHtml(auth.id)}<br/>
        <strong>Hash SHA-256:</strong> ${escapeHtml(auth.hash)}
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
  // Ícone vetorial próprio do SenexCare: documento protegido, sem reutilizar marca do SEI.
  doc.roundedRect(margin + 2, y + 3, 24, 16, 1, 1);
  doc.rect(margin + 5, y + 5, 7, 10);
  doc.line(margin + 7, y + 8, margin + 10, y + 8);
  doc.roundedRect(margin + 9, y + 11, 5, 5, 0.7, 0.7);
  doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(35);
  doc.text('SenexCare', margin + 15, y + 8);
  doc.setFont('helvetica', 'normal').setFontSize(4.8);
  doc.text('assinatura', margin + 15, y + 11);
  doc.text('eletrônica', margin + 15, y + 13.5);
  doc.setFont('helvetica', assinatura ? 'normal' : 'bold').setFontSize(7.3);
  const textoAssinatura = assinatura
    ? `Documento assinado eletronicamente por ${assinatura.nome}${assinatura.papel ? `, ${assinatura.papel}` : ''} em ${formatarAssinatura(assinatura.assinadoEm)}.`
    : 'DOCUMENTO ELETRÔNICO · AUTENTICIDADE — este bloco comprova integridade e não representa assinatura.';
  doc.text(doc.splitTextToSize(textoAssinatura, w - margin * 2 - 31), margin + 30, y + 8);
  doc.line(margin, y + 22, w - margin, y + 22);
  doc.addImage(auth.qrDataUrl, 'PNG', margin + 2, y + 25, 25, 25);
  const x = margin + 31;
  const disponivel = w - margin - x - 2;
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(45);
  doc.text('Confira a autenticidade deste documento em:', x, y + 29);
  doc.text(doc.splitTextToSize(auth.urlVerificacao, disponivel), x, y + 33);
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text(doc.splitTextToSize(`Código verificador: ${auth.id}`, disponivel), x, y + 42);
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  doc.text(doc.splitTextToSize(`SHA-256: ${auth.hash}`, disponivel), x, y + 47);
  doc.line(margin, y + 53, w - margin, y + 53);
  doc.setTextColor(0);
}