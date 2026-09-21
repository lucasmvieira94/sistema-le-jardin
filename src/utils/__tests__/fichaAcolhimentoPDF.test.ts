import { describe, expect, it } from "vitest";
import {
  criarNomeArquivoFicha,
  podeBaixarFichaAcolhimento,
} from "../fichaAcolhimentoPDF";

describe("download da ficha de acolhimento", () => {
  it("permite baixar somente fichas preenchidas ou aprovadas", () => {
    expect(podeBaixarFichaAcolhimento("pendente")).toBe(false);
    expect(podeBaixarFichaAcolhimento("preenchida")).toBe(true);
    expect(podeBaixarFichaAcolhimento("aprovada")).toBe(true);
  });

  it("gera um nome de arquivo seguro e identificável", () => {
    expect(criarNomeArquivoFicha("João da Silva / Filho", "2026-09-20T14:30:00Z"))
      .toBe("ficha-acolhimento-joao-da-silva-filho-20-09-2026.pdf");
  });

  it("usa valores seguros quando o nome e a data são inválidos", () => {
    expect(criarNomeArquivoFicha("---", "data-invalida"))
      .toBe("ficha-acolhimento-residente-sem-data.pdf");
  });
});