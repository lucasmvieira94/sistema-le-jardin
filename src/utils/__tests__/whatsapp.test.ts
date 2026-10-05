import { describe, it, expect } from "vitest";
import { formatarNumeroWhatsApp, gerarLinkWhatsApp } from "../whatsapp";

describe("formatarNumeroWhatsApp", () => {
  it("adiciona DDI 55 a celular com máscara", () => {
    expect(formatarNumeroWhatsApp("(11) 98765-4321")).toBe("5511987654321");
  });
  it("aceita fixo de 10 dígitos e número já com +55", () => {
    expect(formatarNumeroWhatsApp("1133334444")).toBe("551133334444");
    expect(formatarNumeroWhatsApp("+55 21 99999-0000")).toBe("5521999990000");
  });
  it("remove zero de discagem", () => {
    expect(formatarNumeroWhatsApp("011 98765-4321")).toBe("5511987654321");
  });
  it("rejeita vazio ou curto", () => {
    expect(formatarNumeroWhatsApp("")).toBeNull();
    expect(formatarNumeroWhatsApp("12345")).toBeNull();
    expect(formatarNumeroWhatsApp(null)).toBeNull();
  });
});

describe("gerarLinkWhatsApp", () => {
  it("codifica a mensagem", () => {
    expect(gerarLinkWhatsApp("11987654321", "Olá & bem-vindo")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1%20%26%20bem-vindo",
    );
  });
  it("sem telefone abre seletor de contato", () => {
    expect(gerarLinkWhatsApp(null, "oi")).toBe("https://wa.me/?text=oi");
  });
  it("telefone inválido retorna null", () => {
    expect(gerarLinkWhatsApp("123", "oi")).toBeNull();
  });
});
