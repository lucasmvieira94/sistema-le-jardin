import { jsPDF } from 'npm:jspdf@4.2.0'
import QRCode from 'npm:qrcode@1.5.4'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const LOGO_URL = 'https://senexcare.app/__l5e/assets-v1/83690979-9b1e-48ba-8142-d26775e6987c/sxcare-assinatura-eletronica.jpg'
const base64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Preserve originals and add the same two-band authenticity footer used in the browser. */
export async function anexarCertificadoPDF(original: ArrayBuffer | Uint8Array, codigo: string, hash: string): Promise<Uint8Array> {
  if (!/^\d{8}$/.test(codigo) || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Certificado inválido')
  const source = await PDFDocument.load(original)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const response = await fetch(LOGO_URL)
  if (!response.ok) throw new Error('Logo de certificação indisponível')
  const logo = new Uint8Array(await response.arrayBuffer())
  const url = `https://senexcare.app/verificar-documento?id=${codigo}&hash=${hash.toUpperCase()}`
  const qr = await QRCode.toDataURL(url, { width: 260, margin: 1, errorCorrectionLevel: 'M' })
  const y = 225
  doc.setDrawColor(150).setLineWidth(0.25)
  doc.line(16, y, 194, y)
  doc.addImage(`data:image/jpeg;base64,${base64(logo)}`, 'JPEG', 17, y + 3, 22, 22)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(35)
  doc.text(doc.splitTextToSize('DOCUMENTO ELETRÔNICO · AUTENTICIDADE — este bloco comprova integridade e não representa assinatura.', 150), 43, y + 10)
  doc.line(16, y + 28, 194, y + 28)
  doc.addImage(qr, 'PNG', 17, y + 31, 25, 25)
  doc.setFontSize(8)
  const texto = `A autenticidade deste documento pode ser conferida no site ${url}, informando o código verificador ${codigo} e o código CRC/SHA-256 ${hash.toUpperCase()}.`
  doc.text(doc.splitTextToSize(texto, 145), 47, y + 35, { lineHeightFactor: 1.25 })
  doc.link(47, y + 30, 145, 28, { url })
  doc.line(16, y + 59, 194, y + 59)
  const footer = await PDFDocument.load(doc.output('arraybuffer'))
  const pages = await source.copyPages(footer, footer.getPageIndices())
  pages.forEach(page => source.addPage(page))
  return source.save()
}

/** Server reports are real PDFs, not JSON renamed with a PDF extension. */
export function gerarRelatorioAgendadoPDF(relatorio: { data_inicio: string; data_fim: string; relatorio?: unknown; resumo_executivo?: string }): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold').setFontSize(16)
  doc.text('Relatório Semanal — Análise com IA', 16, 20)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`Período: ${relatorio.data_inicio} a ${relatorio.data_fim}`, 16, 29)
  const conteudo = typeof relatorio.relatorio === 'object' && relatorio.relatorio ? relatorio.relatorio : { resumo_executivo: relatorio.resumo_executivo ?? '' }
  let y = 40
  const escrever = (text: string) => {
    for (const line of doc.splitTextToSize(text, 178)) {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(line, 16, y); y += 5
    }
    y += 4
  }
  const visitar = (value: unknown, label = '') => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) { if (label) escrever(label.replace(/_/g, ' ')); value.forEach((item, i) => visitar(item, `${i + 1}`)); return }
    if (typeof value === 'object') { if (label) escrever(label.replace(/_/g, ' ')); Object.entries(value).forEach(([key, item]) => visitar(item, key)); return }
    escrever(`${label ? label.replace(/_/g, ' ') + ': ' : ''}${String(value)}`)
  }
  visitar(conteudo)
  return doc.output('arraybuffer')
}

export const pdfBase64 = (bytes: Uint8Array) => base64(bytes)