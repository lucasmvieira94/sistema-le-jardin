import { describe, expect, it } from "vitest";
import {
  agruparPorFuncionario,
  ordenarHistorico,
  periodoNaData,
  validarPeriodo,
  validarTrocaEscala,
  type PeriodoEscala,
} from "../escalaVigente";

const hist: PeriodoEscala[] = [
  { id: "a", funcionario_id: "f1", escala_id: 1, data_inicio: "2026-01-01", data_fim: "2026-09-14" },
  { id: "b", funcionario_id: "f1", escala_id: 2, data_inicio: "2026-09-15", data_fim: null },
];

describe("escala vigente por data", () => {
  it("troca no meio do mês: dias anteriores seguem a escala antiga", () => {
    expect(periodoNaData(hist, "2026-09-10")?.escala_id).toBe(1);
    expect(periodoNaData(hist, "2026-09-14")?.escala_id).toBe(1);
    expect(periodoNaData(hist, "2026-09-15")?.escala_id).toBe(2);
    expect(periodoNaData(hist, "2027-03-01")?.escala_id).toBe(2);
  });

  it("dia antes do primeiro período não tem escala", () => {
    expect(periodoNaData(hist, "2025-12-31")).toBeNull();
  });

  it("ordena e agrupa", () => {
    expect(ordenarHistorico(hist).map((p) => p.id)).toEqual(["b", "a"]);
    expect(agruparPorFuncionario(hist).get("f1")?.length).toBe(2);
  });

  it("valida troca futura e rejeita data igual/anterior a período existente", () => {
    expect(validarTrocaEscala(hist, 3, "2026-10-20")).toBeNull();
    expect(validarTrocaEscala(hist, 3, "2026-09-15")).toMatch(/Já existe/);
    expect(validarTrocaEscala(hist, 3, "2026-09-01")).toMatch(/Já existe/);
    expect(validarTrocaEscala(hist, 2, "2026-10-20")).toMatch(/já está/);
  });

  it("período antigo retroativo e sobreposição", () => {
    expect(validarPeriodo(hist, { data_inicio: "2025-06-01", data_fim: "2025-12-31" })).toBeNull();
    expect(validarPeriodo(hist, { data_inicio: "2025-06-01", data_fim: "2026-01-01" })).toMatch(/sobrepõe/);
    expect(validarPeriodo(hist, { id: "a", data_inicio: "2026-01-05", data_fim: "2026-09-14" })).toBeNull();
    expect(validarPeriodo(hist, { data_inicio: "2026-02-01", data_fim: "2026-01-01" })).toMatch(/posterior/);
  });
});

import { calcularDiasTrabalhadosPorHistorico } from "../valeTransporteCalculator";

describe("vale-transporte com troca de escala", () => {
  it("conta cada período pela sua jornada", () => {
    // set/2026: 1-14 seg-sex (10 dias úteis), 15-30 seg-sab (14 dias)
    const dias = calcularDiasTrabalhadosPorHistorico({ ano: 2026, mes: 9, jornada: "" }, [
      { data_inicio: "2026-01-01", data_fim: "2026-09-14", jornada: "40h_8h_segsex" },
      { data_inicio: "2026-09-15", data_fim: null, jornada: "44h_8h_segsex_4h_sab" },
    ]);
    expect(dias).toBe(10 + 14);
  });
});

import { mudaRevezamento } from "../escalaVigente";

describe("mudança de revezamento na mesma escala", () => {
  const h12: PeriodoEscala[] = [{ id: "x", funcionario_id: "f1", escala_id: 7, data_inicio: "2026-09-02", data_fim: null }];

  it("12x36 de dia par para ímpar é aceita com motivo", () => {
    expect(mudaRevezamento("12x36", "2026-09-02", "2026-10-05")).toBe(true);
    expect(validarTrocaEscala(h12, 7, "2026-10-05", "12x36", "Pedido do funcionário")).toBeNull();
    expect(validarTrocaEscala(h12, 7, "2026-10-05", "12x36", "")).toMatch(/motivo/);
  });

  it("rejeita data que mantém a mesma sequência", () => {
    expect(mudaRevezamento("12x36", "2026-09-02", "2026-10-04")).toBe(false);
    expect(validarTrocaEscala(h12, 7, "2026-10-04", "12x36", "x")).toMatch(/já trabalharia/);
  });

  it("escala semanal fixa não aceita a mesma escala", () => {
    expect(validarTrocaEscala(h12, 7, "2026-10-05", "40h_8h_segsex", "x")).toMatch(/já está/);
  });

  it("24x48 e 6x1 usam o tamanho do ciclo", () => {
    expect(mudaRevezamento("24x48", "2026-09-01", "2026-09-04")).toBe(false);
    expect(mudaRevezamento("24x48", "2026-09-01", "2026-09-05")).toBe(true);
    expect(mudaRevezamento("6x1", "2026-09-01", "2026-09-08")).toBe(false);
  });
});
