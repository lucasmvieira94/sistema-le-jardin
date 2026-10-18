import { describe, it, expect } from "vitest";
import { calcularDistrato } from "../distratoContrato";

const base = { valorMensalidade: 3000, dataInicioContrato: "2026-01-01" };

describe("calcularDistrato", () => {
  it("aviso prévio soma 30 dias à data do distrato", () => {
    const r = calcularDistrato({ ...base, tipo: "aviso_previo", dataDistrato: "2026-10-17" });
    expect(r.dataEfetiva).toBe("2026-11-16");
    expect(r.valorProporcional).toBe(1600); // 16/30 de 3000
  });

  it("sem aviso prévio gera indenização de 1 mensalidade", () => {
    const r = calcularDistrato({ ...base, tipo: "sem_aviso", dataDistrato: "2026-11-15", parteIniciadora: "contratante" });
    expect(r.dataEfetiva).toBe("2026-11-15");
    expect(r.valorIndenizacao).toBe(3000);
    expect(r.valorTotal).toBe(4500);
  });

  it("indenização paga pela contratada reduz o saldo do contratante", () => {
    const r = calcularDistrato({ ...base, tipo: "sem_aviso", dataDistrato: "2026-11-15", parteIniciadora: "contratada" });
    expect(r.valorTotal).toBe(-1500);
  });

  it("falecimento cobra o mês integral", () => {
    const r = calcularDistrato({ ...base, tipo: "falecimento", dataDistrato: "2026-10-05" });
    expect(r.valorProporcional).toBe(3000);
  });

  it("adaptação de 4 dias cobra R$ 1.000", () => {
    const r = calcularDistrato({ ...base, tipo: "adaptacao", dataInicioContrato: "2026-10-01", dataDistrato: "2026-10-04" });
    expect(r.valorAdaptacao).toBe(1000);
  });

  it("unilateral por atraso retém a garantia; por nova AGDI não", () => {
    expect(calcularDistrato({ ...base, tipo: "unilateral_I", dataDistrato: "2026-10-10" }).retemGarantia).toBe(true);
    expect(calcularDistrato({ ...base, tipo: "unilateral_III", dataDistrato: "2026-10-10" }).retemGarantia).toBe(false);
  });

  it("acordo usa data e valor livres e soma pendências", () => {
    const r = calcularDistrato({ ...base, tipo: "acordo", dataDistrato: "2026-10-10", dataEfetivaAcordo: "2026-10-20", valorAcordo: 500, pendencias: 3000 });
    expect(r.dataEfetiva).toBe("2026-10-20");
    expect(r.valorTotal).toBe(3500);
  });
});
