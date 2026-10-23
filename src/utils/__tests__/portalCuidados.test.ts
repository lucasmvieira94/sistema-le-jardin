import { describe, it, expect } from "vitest";
import { podeAcessarPortalCuidados, atalhosLiberados, semCamposProibidos, filtrarResidentes, idade } from "../portalCuidados";
import { modulosEfetivos } from "../modulosCargo";

describe("acesso ao Portal de Cuidados", () => {
  it("cargo sem o módulo não entra", () => {
    expect(podeAcessarPortalCuidados(modulosEfetivos({ modulos: ["ponto", "escala"] }, {}))).toBe(false);
  });
  it("cargo com o módulo entra", () => {
    expect(podeAcessarPortalCuidados(modulosEfetivos({ modulos: ["portal_cuidados"] }, {}))).toBe(true);
  });
  it("bloqueio individual tira o acesso mesmo que o cargo libere", () => {
    expect(podeAcessarPortalCuidados(modulosEfetivos({ modulos: ["portal_cuidados"] }, { modulos_bloqueados: ["portal_cuidados"] }))).toBe(false);
  });
  it("atalhos exigem o portal e o módulo do atalho", () => {
    expect(atalhosLiberados(["prontuario", "fraldas"])).toEqual([]);
    expect(atalhosLiberados(["portal_cuidados", "fraldas"]).map((a) => a.id)).toEqual(["fraldas"]);
  });
});

describe("dados do residente", () => {
  it("remove CPF, e-mail e endereço do responsável e dados financeiros", () => {
    const r = semCamposProibidos({
      nome_completo: "Maria", responsavel_nome: "João", responsavel_telefone: "11999",
      responsavel_cpf: "1", responsavel_email: "a@b", responsavel_endereco: "Rua", mensalidades: [1],
      acolhimento: { preenchido_por_cpf: "2", historico_saude: { alergias: "x" } },
    });
    expect(r).toEqual({ nome_completo: "Maria", responsavel_nome: "João", responsavel_telefone: "11999", acolhimento: { historico_saude: { alergias: "x" } } });
  });
  it("busca por nome sem acento ou por quarto", () => {
    const l = [{ nome_completo: "Antônia", quarto: "03" }, { nome_completo: "José", quarto: "12" }];
    expect(filtrarResidentes(l, "antonia")).toHaveLength(1);
    expect(filtrarResidentes(l, "12")[0].nome_completo).toBe("José");
  });
  it("calcula idade em anos completos", () => {
    expect(idade("1940-10-23", new Date("2026-10-22T12:00:00"))).toBe(85);
    expect(idade("1940-10-22", new Date("2026-10-22T12:00:00"))).toBe(86);
  });
});
