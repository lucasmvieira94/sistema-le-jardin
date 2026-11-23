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
  cpf?: string | null;
  local?: string | null;
}

type Assinaturas = RegistroAssinaturaDocumento | RegistroAssinaturaDocumento[] | null | undefined;
const listaAssinaturas = (a: Assinaturas) => (Array.isArray(a) ? a : a ? [a] : []);

/** LGPD: exibe apenas os 6 dígitos centrais do CPF (***.456.789-**). */
export const mascararCpf = (cpf?: string | null): string | null => {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};

/** Linha de um signatário: nome, cargo, CPF mascarado, data/hora de Brasília e local. */
export const textoSignatario = (a: RegistroAssinaturaDocumento): string => {
  const cpf = mascararCpf(a.cpf);
  return `${a.nome}${a.papel ? `, ${a.papel}` : ''}${cpf ? `, CPF ${cpf}` : ''}, em ${formatarDataHoraAssinatura(a.assinadoEm)} (horário oficial de Brasília)${a.local ? `, ${a.local}` : ''}`;
};

export const textoAssinaturas = (lista: RegistroAssinaturaDocumento[]): string =>
  `Documento AUTÊNTICO assinado eletronicamente por: ${lista.map(textoSignatario).join('; ')}.`;

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
  assinatura?: Assinaturas,
): string {
  const url = escapeHtml(auth.urlVerificacao);
  const lista = listaAssinaturas(assinatura);
  const faixaAssinatura = lista.length
    ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #999;line-height:1.45;">
        ${iconeSenexCareHTML()}
        <div style="min-width:0"><strong>Documento AUTÊNTICO assinado eletronicamente por:</strong>${lista.map(a => `<div>• ${escapeHtml(textoSignatario(a))}</div>`).join('')}</div>
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
  assinatura?: Assinaturas,
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - alturaRodapePDF(doc, assinatura, margin);
  if (!logoPDF) throw new Error('Logo de certificação indisponível. A emissão foi interrompida.');
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  doc.line(margin, y, w - margin, y);
  doc.addImage(logoPDF, 'JPEG', margin + 1, y + 3, 22, 22);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(35);
  const lista = listaAssinaturas(assinatura);
  const linhasAssinatura: string[] = lista.length
    ? ['Documento AUTÊNTICO assinado eletronicamente por:', ...lista.flatMap(a => doc.splitTextToSize(`• ${textoSignatario(a)}`, w - margin * 2 - 28) as string[])]
    : doc.splitTextToSize('DOCUMENTO ELETRÔNICO · AUTENTICIDADE — este bloco comprova integridade e não representa assinatura.', w - margin * 2 - 28);
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
/** Altura (mm) que o rodapé ocupará — usada para reservar espaço na mesma página. */
export function alturaRodapePDF(doc: jsPDF, assinatura?: Assinaturas, margin = 18): number {
  const lista = listaAssinaturas(assinatura);
  if (!lista.length) return 72;
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const n = 1 + lista.reduce((t, a) => t + (doc.splitTextToSize(`• ${textoSignatario(a)}`, w - margin * 2 - 28) as string[]).length, 0);
  return Math.max(72, Math.max(28, n * 4 + 8) + 31 + 13 + 4);
}
