import { describe, it, expect } from "vitest";
import { modulosEfetivos, excecoesParaCargo, MODULOS_LEGADO } from "../modulosCargo";

describe("modulosEfetivos", () => {
  it("herda os módulos do cargo", () => {
    expect(modulosEfetivos({ modulos: ["ponto", "prontuario"] }, {})).toEqual(["ponto", "prontuario"]);
  });
  it("soma módulos extras do funcionário", () => {
    expect(modulosEfetivos({ modulos: ["ponto"] }, { modulos_extras: ["supervisor"] })).toEqual(["ponto", "supervisor"]);
  });
  it("remove módulos bloqueados mesmo que o cargo libere", () => {
    expect(modulosEfetivos({ modulos: ["ponto", "vacinas"] }, { modulos_bloqueados: ["vacinas"] })).toEqual(["ponto"]);
  });
  it("sem cargo mantém o acesso antigo e o painel do supervisor só com a opção marcada", () => {
    expect(modulosEfetivos(null, {})).not.toContain("supervisor");
    expect(modulosEfetivos(null, {}).length).toBe(MODULOS_LEGADO.length);
    expect(modulosEfetivos(null, { acesso_supervisor: true })).toContain("supervisor");
  });
  it("cargo sem módulos não libera nada", () => {
    expect(modulosEfetivos({ modulos: [] }, {})).toEqual([]);
  });
});

describe("excecoesParaCargo", () => {
  it("gera extras e bloqueios relativos ao cargo", () => {
    expect(excecoesParaCargo(["ponto", "vacinas"], ["ponto", "supervisor"])).toEqual({
      modulos_extras: ["supervisor"],
      modulos_bloqueados: ["vacinas"],
    });
  });
});
