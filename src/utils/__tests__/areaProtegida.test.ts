import { describe, expect, it } from "vitest";
import { AREA_PROTEGIDA } from "../areaProtegida";

describe("contatos da área protegida", () => {
  it("mantém o telefone 40202571 informado pela instituição", () => {
    expect(AREA_PROTEGIDA.telefones[0]).toBe("40202571");
  });
  it("mantém o telefone alternativo 30033010", () => {
    expect(AREA_PROTEGIDA.telefones[1]).toBe("30033010");
  });
  it("mantém o código do contratante 1028160000", () => {
    expect(AREA_PROTEGIDA.codigoContratante).toBe("1028160000");
  });
});