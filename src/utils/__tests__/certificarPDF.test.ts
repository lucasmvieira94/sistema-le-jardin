import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logo: vi.fn(), render: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('../rodapeDocumento', () => ({ carregarLogoRodape: mocks.logo, renderRodapeDocumentoPDF: mocks.render }));
import { certificarPDF, seloDaEmissao } from '../certificarPDF';

describe('emissão obrigatoriamente certificada', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('não permite emitir quando o registro falha', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('indisponível') });
    const pdf = new jsPDF();
    await expect(certificarPDF(pdf, { tipo: 'relatorio', titulo: 'Relatório' }, 40)).rejects.toThrow('certificar');
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('exige código persistido de oito dígitos', async () => {
    await expect(seloDaEmissao({ codigo_verificador: '1234567', hash: 'a'.repeat(64) })).rejects.toThrow('inválido');
  });
  it('exige SHA-256 integral', async () => {
    await expect(seloDaEmissao({ codigo_verificador: '12345678', hash: 'abcd' })).rejects.toThrow('inválido');
  });
  it('registra o hash do conteúdo e aponta o QR para a verificação oficial', async () => {
    const hash = 'A'.repeat(64);
    mocks.invoke.mockResolvedValue({ data: { codigo_verificador: '12345678', hash } });
    const pdf = new jsPDF();
    pdf.text('Documento de teste', 20, 20);
    const selo = await certificarPDF(pdf, { tipo: 'folha_ponto', titulo: 'Folha' }, 50);
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.hash_conteudo).toMatch(/^[A-F0-9]{64}$/);
    expect(selo.urlVerificacao).toBe(`https://senexcare.app/verificar-documento?id=12345678&hash=${hash}`);
    expect(selo.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(mocks.render).toHaveBeenCalledWith(pdf, selo, 16);
    expect(pdf.getNumberOfPages()).toBe(1);
  });
  it('preserva as páginas quando não há espaço para o rodapé', async () => {
    mocks.invoke.mockResolvedValue({ data: { codigo_verificador: '12345678', hash: 'a'.repeat(64) } });
    const pdf = new jsPDF();
    pdf.text('Primeira página', 20, 20);
    pdf.addPage(); pdf.text('Segunda página', 20, 20);
    await certificarPDF(pdf, { tipo: 'relatorio', titulo: 'Relatório' }, 270);
    expect((await PDFDocument.load(pdf.output('arraybuffer'))).getPageCount()).toBe(3);
  });
});