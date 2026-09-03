import { describe, it, expect } from "vitest";
import {
  calcularStatusContrato,
  selecionarContratoVigente,
  type ContratoResumo,
} from "../contratoStatus";

const base: ContratoResumo = {
  id: "1",
  residente_id: "r1",
  numero_contrato: "001/2026",
  status: "ativo",
  data_inicio_contrato: "2026-01-01",
  data_fim_contrato: null,
};

const HOJE = "2026-09-03";

describe("calcularStatusContrato", () => {
  it("retorna sem_contrato quando não há contratos ativos", () => {
    expect(calcularStatusContrato([], HOJE).key).toBe("sem_contrato");
    expect(
      calcularStatusContrato([{ ...base, status: "encerrado" }], HOJE).key
    ).toBe("sem_contrato");
  });

  it("considera contrato sem data de fim como em dia", () => {
    expect(calcularStatusContrato([base], HOJE).key).toBe("em_dia");
  });

  it("marca como próximo de renovação dentro de 60 dias", () => {
    const info = calcularStatusContrato(
      [{ ...base, data_fim_contrato: "2026-10-01" }],
      HOJE
    );
    expect(info.key).toBe("proximo_renovacao");
    expect(info.diasRestantes).toBe(28);
  });

  it("marca como vencido após a data de fim", () => {
    const info = calcularStatusContrato(
      [{ ...base, data_fim_contrato: "2026-08-30" }],
      HOJE
    );
    expect(info.key).toBe("vencido");
    expect(info.diasRestantes).toBe(-4);
  });

  it("marca como em dia quando falta mais de 60 dias", () => {
    expect(
      calcularStatusContrato([{ ...base, data_fim_contrato: "2027-01-01" }], HOJE).key
    ).toBe("em_dia");
  });

  it("seleciona o contrato ativo com término mais distante", () => {
    const vigente = selecionarContratoVigente([
      { ...base, id: "a", data_fim_contrato: "2026-10-01" },
      { ...base, id: "b", data_fim_contrato: "2027-03-01" },
    ]);
    expect(vigente?.id).toBe("b");
  });
});
