import { describe, expect, it } from "vitest";
import { deveBaixarRecibo, obterAssinaturaEmpresa } from "../reciboPDF";

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
      rubricaBase64: "data:image/png;base64,abc",
    });
  });

  it("impede a emissão sem rubrica institucional", () => {
    expect(() => obterAssinaturaEmpresa({
      assinatura_empresa_nome: "Maria Silva",
      assinatura_empresa_base64: null,
    })).toThrow("Configure a assinatura digital da empresa");
  });

  it("impede a emissão sem identificação do responsável", () => {
    expect(() => obterAssinaturaEmpresa({
      assinatura_empresa_nome: " ",
      assinatura_empresa_base64: "data:image/png;base64,abc",
    })).toThrow("Configure a assinatura digital da empresa");
  });
});