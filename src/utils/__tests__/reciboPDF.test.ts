import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), footer: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ limit: () => ({ maybeSingle: async () => ({ data: {
    nome_empresa: 'Empresa', assinatura_empresa_nome: 'Gestora',
    assinatura_empresa_base64: null,
  } }) }) }) }), functions: { invoke: mocks.invoke },
} }));
vi.mock('../rodapeDocumento', () => ({ carregarLogoRodape: async () => null, renderRodapeDocumentoPDF: mocks.footer }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,QR' } }));
import { deveBaixarRecibo, obterAssinaturaEmpresa, gerarReciboPDF } from "../reciboPDF";

const dadosRecibo = {
  residenteNome: 'Residente', competencia: '2026-11-01', dataVencimento: '2026-11-05',
  dataPagamento: '2026-11-02', valorMensalidade: 1000, valorExtras: 0,
  valorDesconto: 0, valorTotal: 1000, valorPago: 1000, formaPagamento: 'pix', numeroRecibo: 'REC-TESTE',
};

describe('identificação do documento no envio do recibo', () => {
  it('envia o UUID do registro e mantém o código de 8 dígitos no rodapé e QR', async () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    mocks.invoke.mockResolvedValueOnce({ data: { id: uuid, codigo_verificador: '12345678', hash: 'a'.repeat(64) } });
    const pdf = await gerarReciboPDF(dadosRecibo);
    expect(pdf.documentoId).toBe(uuid);
    expect(pdf.autenticidadeHash).toBe('A'.repeat(64));
    expect(Buffer.from(pdf.base64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(mocks.footer).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      id: '12345678', urlVerificacao: expect.stringContaining('id=12345678'),
    }), expect.any(Number), expect.any(Object));
  });
  it('não entrega recibo se o registro retornar só código verificador, sem UUID', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { codigo_verificador: '12345678', hash: 'a'.repeat(64) } });
    await expect(gerarReciboPDF(dadosRecibo)).rejects.toThrow('Não foi possível autenticar o recibo');
  });
});

describe("entrega do recibo", () => {
  it("não baixa automaticamente quando nenhuma opção é informada", () => {
    expect(deveBaixarRecibo()).toBe(false);
  });

  it("baixa somente quando solicitado explicitamente", () => {
    expect(deveBaixarRecibo({ entrega: "download" })).toBe(true);
    expect(deveBaixarRecibo({ entrega: "base64" })).toBe(false);
  });
});

describe("assinatura eletrônica do recibo", () => {
  it("normaliza a assinatura institucional configurada", () => {
    expect(obterAssinaturaEmpresa({
      assinatura_empresa_nome: "  Maria Silva  ",
      assinatura_empresa_cargo: " Diretora ",
      assinatura_empresa_cpf: " 000.000.000-00 ",
      assinatura_empresa_base64: " data:image/png;base64,abc ",
    })).toEqual({
      nome: "Maria Silva",
      cargo: "Diretora",
      cpf: "000.000.000-00",
    });
  });

  it("permite emissão com identidade institucional sem imagem de assinatura", () => {
    expect(obterAssinaturaEmpresa({
      assinatura_empresa_nome: "Maria Silva",
      assinatura_empresa_base64: null,
    })).toEqual({ nome: "Maria Silva", cargo: null, cpf: null });
  });

  it("impede a emissão sem identificação do responsável", () => {
    expect(() => obterAssinaturaEmpresa({
      assinatura_empresa_nome: " ",
      assinatura_empresa_base64: "data:image/png;base64,abc",
    })).toThrow("Configure a assinatura digital da empresa");
  });
});