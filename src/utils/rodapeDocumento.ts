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

let logoPDF: string | undefined;
let carregandoLogo: Promise<void> | undefined;
/** O PDF usa o mesmo logo quadrado do documento de referência, não uma aproximação vetorial. */
export async function carregarLogoRodape(): Promise<void> {
  if (logoPDF) return;
  if (!carregandoLogo) carregandoLogo = (async () => {
    const response = await fetch(new URL(sxCareLogo.url, 'https://senexcare.app').href);
    if (!response.ok) throw new Error('Não foi possível carregar o logo de certificação.');
    const blob = await response.blob();
    const header = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) throw new Error('A imagem de certificação não é um JPEG válido.');
    logoPDF = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Logo inválido.'));
      reader.onerror = () => reject(new Error('Não foi possível ler o logo de certificação.'));
      reader.readAsDataURL(blob);
    });
  })().catch(error => { carregandoLogo = undefined; throw error; });
  await carregandoLogo;
}

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

/** Duas faixas conforme o documento de referência; reservar 72 mm no fim da página. */
export function renderRodapeDocumentoPDF(
  doc: jsPDF,
  auth: SeloAutenticidade,
  margin = 18,
  assinatura?: RegistroAssinaturaDocumento | null,
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - 72;
  if (!logoPDF) throw new Error('Logo de certificação indisponível. A emissão foi interrompida.');
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  doc.line(margin, y, w - margin, y);
  doc.addImage(logoPDF, 'JPEG', margin + 1, y + 3, 22, 22);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(35);
  const textoAssinatura = assinatura
    ? `Documento assinado eletronicamente por ${assinatura.nome}${assinatura.papel ? `, ${assinatura.papel}` : ''} em ${formatarDataHoraAssinatura(assinatura.assinadoEm)}, conforme horário oficial de Brasília.`
    : 'DOCUMENTO ELETRÔNICO · AUTENTICIDADE — este bloco comprova integridade e não representa assinatura.';
  const linhasAssinatura = doc.splitTextToSize(textoAssinatura, w - margin * 2 - 28);
  const fimSuperior = y + Math.max(28, linhasAssinatura.length * 4 + 8);
  doc.text(linhasAssinatura, margin + 27, y + 10, { lineHeightFactor: 1.25 });
  doc.line(margin, fimSuperior, w - margin, fimSuperior);
  doc.addImage(auth.qrDataUrl, 'PNG', margin + 1, fimSuperior + 3, 25, 25);
  const x = margin + 31;
  const disponivel = w - margin - x - 2;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(35);
  const textoVerificacao = `A autenticidade deste documento pode ser conferida no site ${auth.urlVerificacao}, informando o código verificador ${auth.id} e o código CRC/SHA-256 ${normalizarHashDocumento(auth.hash)}.`;
  const linhasVerificacao = doc.splitTextToSize(textoVerificacao, disponivel);
  doc.text(linhasVerificacao, x, fimSuperior + 7, { lineHeightFactor: 1.25 });
  const fimInferior = fimSuperior + Math.max(31, linhasVerificacao.length * 3.6 + 9);
  if (fimInferior > h - 12) throw new Error('O rodapé excedeu o espaço disponível. Reduza os dados do signatário.');
  doc.link(x, fimSuperior + 2, disponivel, fimInferior - fimSuperior - 2, { url: auth.urlVerificacao });
  doc.line(margin, fimInferior, w - margin, fimInferior);
  doc.setTextColor(0);
}