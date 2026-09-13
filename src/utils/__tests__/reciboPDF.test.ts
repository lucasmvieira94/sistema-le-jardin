import { describe, expect, it } from "vitest";
import { deveBaixarRecibo } from "../reciboPDF";

describe("entrega do recibo", () => {
  it("não baixa automaticamente quando nenhuma opção é informada", () => {
    expect(deveBaixarRecibo()).toBe(false);
  });

  it("baixa somente quando solicitado explicitamente", () => {
    expect(deveBaixarRecibo({ entrega: "download" })).toBe(true);
    expect(deveBaixarRecibo({ entrega: "base64" })).toBe(false);
  });
});