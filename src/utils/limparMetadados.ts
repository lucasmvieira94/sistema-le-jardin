/**
 * Remove metadados de arquivos antes do envio ao Canal de Denúncias,
 * para que o autor não seja descoberto pelas propriedades do arquivo.
 * - Imagens: redesenhadas em canvas (apaga EXIF, GPS, câmera).
 * - PDF: apaga autor, título, assunto, criador, produtor, datas e XMP.
 * - Áudio: enviado como está (não há metadado de autoria comum); a tela avisa sobre a voz.
 */
import { PDFDocument, PDFName } from "pdf-lib";

async function limparImagem(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha na imagem"))), "image/jpeg", 0.9));
}

async function limparPdf(f: File): Promise<Blob> {
  const doc = await PDFDocument.load(await f.arrayBuffer(), { updateMetadata: false });
  doc.setTitle(""); doc.setAuthor(""); doc.setSubject(""); doc.setKeywords([]);
  doc.setCreator(""); doc.setProducer("");
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  doc.catalog.delete(PDFName.of("Metadata"));
  return new Blob([await doc.save()], { type: "application/pdf" });
}

export async function arquivoSemMetadados(f: File): Promise<{ blob: Blob; mime: string; nome: string }> {
  const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
  if (f.type.startsWith("image/")) return { blob: await limparImagem(f), mime: "image/jpeg", nome: `imagem${Date.now() % 10000}.jpg` };
  if (f.type === "application/pdf") return { blob: await limparPdf(f), mime: "application/pdf", nome: `documento${Date.now() % 10000}.pdf` };
  return { blob: f, mime: f.type, nome: `audio${Date.now() % 10000}${ext}` };
}

export async function blobParaBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
