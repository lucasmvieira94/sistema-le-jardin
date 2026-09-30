import { describe, expect, it, vi } from "vitest";

// Componentes não interessam ao teste das regras de ordenação
vi.mock("../RegistrosHoje", () => ({ default: () => null }));
vi.mock("../AlertasEscalas", () => ({ default: () => null }));
vi.mock("../AlertasProntuarios", () => ({ default: () => null }));
vi.mock("../AlertasProntuariosAtraso", () => ({ default: () => null }));
vi.mock("../AlertasMedicamentos", () => ({ default: () => null }));
vi.mock("../AlertasFraldas", () => ({ AlertasFraldas: () => null }));
vi.mock("../AlertasContasPagar", () => ({ default: () => null }));
vi.mock("../AlertasContratosResidentes", () => ({ default: () => null }));
vi.mock("../MonitoramentoPonto", () => ({ default: () => null }));

import { aplicarPreferencias, aplicarSugestao, IDS_QUADROS } from "../registroQuadros";

describe("preferências do painel", () => {
  it("sem preferência mostra todos na ordem padrão", () => {
    expect(aplicarPreferencias(null).map((q) => q.id)).toEqual(IDS_QUADROS);
  });

  it("respeita ordem, oculta e ignora ids desconhecidos", () => {
    const ids = aplicarPreferencias({ ordem: ["fraldas", "xpto", "ponto"], ocultos: ["contratos"] }).map((q) => q.id);
    expect(ids.slice(0, 2)).toEqual(["fraldas", "ponto"]);
    expect(ids).not.toContain("contratos");
    expect(ids).not.toContain("xpto");
    expect(ids.length).toBe(IDS_QUADROS.length - 1);
  });

  it("aplica sugestões de remover, adicionar e reordenar", () => {
    let p = aplicarSugestao({ ordem: [], ocultos: [] }, { tipo: "remover", quadro: "escalas" });
    expect(p.ocultos).toEqual(["escalas"]);
    p = aplicarSugestao(p, { tipo: "adicionar", quadro: "escalas", posicao: 0 });
    expect(p.ocultos).toEqual([]);
    expect(p.ordem[0]).toBe("escalas");
    p = aplicarSugestao(p, { tipo: "reordenar", quadro: "ponto", posicao: 1 });
    expect(p.ordem.slice(0, 2)).toEqual(["escalas", "ponto"]);
  });

  it("ignora sugestão para quadro inexistente", () => {
    const p = { ordem: [], ocultos: [] };
    expect(aplicarSugestao(p, { tipo: "remover", quadro: "inexistente" })).toBe(p);
  });
});
