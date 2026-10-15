import { describe, expect, it } from "vitest";
import { nomeArquivoFichaFuncionario } from "../fichaFuncionarioPDF";

describe("nome do arquivo da ficha do funcionário", () => {
  it("gera nome seguro com data dd-mm-aaaa", () => {
    expect(nomeArquivoFichaFuncionario("Maria José / Souza", "2026-10-15"))
      .toBe("ficha-funcionario-maria-jose-souza-15-10-2026.pdf");
  });
  it("usa padrões quando nome e data são inválidos", () => {
    expect(nomeArquivoFichaFuncionario("***", "x")).toBe("ficha-funcionario-funcionario-sem-data.pdf");
  });
});
