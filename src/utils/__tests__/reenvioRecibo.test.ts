import { describe, expect, it, vi } from "vitest";
import { enviarTentativaRecibo, podeReenviarRecibo, type TentativaRecibo } from "../reenvioRecibo";

const dados = {
  residenteNome: "Residente", competencia: "2026-10-01", dataVencimento: "2026-10-10",
  dataPagamento: "2026-10-29", valorMensalidade: 2000, valorExtras: 0,
  valorDesconto: 0, valorTotal: 2000, valorPago: 500, formaPagamento: "pix", numeroRecibo: "REC-1",
};
const pdf = { base64: "PDF-certificado", filename: "recibo.pdf", documentoId: "12345678", autenticidadeHash: "ABC" };

describe("reenvio de recibos", () => {
  it("permite reenviar recebimentos pagos e parciais, mas não cancelados ou sem pagamento", () => {
    expect(podeReenviarRecibo({ status: "pago", valor_pago: 2000 })).toBe(true);
    expect(podeReenviarRecibo({ status: "parcial", valor_pago: 500 })).toBe(true);
    expect(podeReenviarRecibo({ status: "cancelado", valor_pago: 500 })).toBe(false);
    expect(podeReenviarRecibo({ status: "pendente", valor_pago: 0 })).toBe(false);
  });

  it("reenvia o mesmo PDF certificado e o valor da parcela após falha, sem gerar outro", async () => {
    const tentativa: TentativaRecibo = { dados };
    const gerar = vi.fn().mockResolvedValue(pdf);
    const enviar = vi.fn().mockRejectedValueOnce(new Error("Falha no envio")).mockResolvedValue(undefined);
    await expect(enviarTentativaRecibo(tentativa, gerar, enviar)).rejects.toThrow("Falha no envio");
    await enviarTentativaRecibo(tentativa, gerar, enviar);
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenNthCalledWith(2, pdf, expect.objectContaining({ valorPago: 500 }));
  });

  it("tenta gerar novamente se a certificação falhou e nunca envia PDF não certificado", async () => {
    const tentativa: TentativaRecibo = { dados };
    const gerar = vi.fn().mockRejectedValueOnce(new Error("Certificação indisponível")).mockResolvedValue(pdf);
    const enviar = vi.fn().mockResolvedValue(undefined);
    await expect(enviarTentativaRecibo(tentativa, gerar, enviar)).rejects.toThrow("Certificação indisponível");
    expect(enviar).not.toHaveBeenCalled();
    await enviarTentativaRecibo(tentativa, gerar, enviar);
    expect(enviar).toHaveBeenCalledWith(pdf, dados);
  });
});