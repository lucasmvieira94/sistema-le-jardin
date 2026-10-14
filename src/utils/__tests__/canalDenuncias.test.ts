import { describe, it, expect } from "vitest";
import { normalizarProtocolo, nivelRisco, proximasSituacoes, prazoVencido, formularioDenunciaSchema, agregarPorMes, PROTOCOLO_RE } from "../canalDenuncias";

describe("canal de denúncias", () => {
  it("normaliza protocolo digitado", () => {
    expect(normalizarProtocolo("a5b98x2q")).toBe("A5-B98-X2Q");
    expect(PROTOCOLO_RE.test(normalizarProtocolo("a5-b98 x2q"))).toBe(true);
  });
  it("classifica risco pela matriz 5x5", () => {
    expect(nivelRisco(5, 3).nivel).toBe("critico");
    expect(nivelRisco(2, 5).nivel).toBe("alto");
    expect(nivelRisco(1, 4).nivel).toBe("baixo");
    expect(nivelRisco(null, 3).nivel).toBe("nao_avaliado");
  });
  it("arquivada não volta a nenhuma situação", () => {
    expect(proximasSituacoes("arquivada")).toEqual([]);
    expect(proximasSituacoes("recebida")).toContain("em_analise");
  });
  it("prazo vencido só para casos abertos", () => {
    expect(prazoVencido("2026-10-01", "em_analise", "2026-10-14")).toBe(true);
    expect(prazoVencido("2026-10-01", "concluida", "2026-10-14")).toBe(false);
  });
  it("identificada exige nome; anônima não", () => {
    const base = { categoria: "assedio_moral", relato: "x".repeat(25) } as const;
    expect(formularioDenunciaSchema.safeParse({ ...base, anonima: true }).success).toBe(true);
    expect(formularioDenunciaSchema.safeParse({ ...base, anonima: false }).success).toBe(false);
  });
  it("agrega por mês no fuso de Brasília", () => {
    const r = agregarPorMes([{ created_at: "2026-10-01T02:00:00Z", categoria: "assedio_moral" }]);
    expect(r[0].mes).toBe("2026-09");
  });
});
