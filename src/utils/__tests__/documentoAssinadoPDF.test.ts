import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { assinaturasEfetivas, juntarOriginalERodape, validarDocumentoParaDownload, type DocumentoAssinadoInput } from '../documentoAssinadoPDF';

const doc: DocumentoAssinadoInput = {
  titulo: 'Comunicado', conteudo_html: '<p>Documento integral</p>', hash_documento: 'a'.repeat(64),
  codigo_verificador: '42486962', url_verificacao: 'https://senexcare.app/verificar-documento?id=42486962',
  signatarios: [
    { nome: 'Lucas', papel: 'Colaborador', metodo: 'biometria_facial', status: 'assinado', assinado_em: '2026-10-06T20:26:51Z' },
    { nome: 'Pendente', papel: 'Colaborador', metodo: 'otp_email', status: 'pendente' },
  ],
};

describe('via integral assinada', () => {
  it('preserva todas as páginas do PDF original antes do rodapé', async () => {
    const original = await PDFDocument.create();
    original.addPage([210, 297]); original.addPage([250, 350]);
    const rodape = await PDFDocument.create(); rodape.addPage([210, 297]);
    const result = await juntarOriginalERodape((await original.save()).buffer as ArrayBuffer, (await rodape.save()).buffer as ArrayBuffer);
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getPage(1).getSize()).toEqual({ width: 250, height: 350 });
  });
  it('não atribui assinatura a signatários pendentes', () => {
    expect(assinaturasEfetivas(doc).map((s) => s.nome)).toEqual(['Lucas']);
  });
  it('bloqueia download sem link real de verificação', () => {
    expect(() => validarDocumentoParaDownload({ ...doc, url_verificacao: null })).toThrow();
    expect(() => validarDocumentoParaDownload(doc)).not.toThrow();
  });
  it('bloqueia códigos que não têm os 8 dígitos persistidos', () => {
    expect(() => validarDocumentoParaDownload({ ...doc, codigo_verificador: 'uuid-ou-hash' })).toThrow();
  });
  it('bloqueia download de comprovante sem original', () => {
    expect(() => validarDocumentoParaDownload({ ...doc, conteudo_html: '' })).toThrow();
  });
});