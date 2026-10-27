import { describe, it, expect } from "vitest";
import { montarMapaDia, prescricaoValeNoDia, statusDose, horariosDaPrescricao, resumoDoses, type PrescricaoMapa } from "../mapaMedicamentos";

const base = (o: Partial<PrescricaoMapa> = {}): PrescricaoMapa => ({
  id: "p1", residente_id: "r1", medicamento_id: "m1", dosagem: "1 cp",
  frequencia_tipo: "hora_fixa_diaria", horarios: ["20:00", "08:00"], data_inicio: "2026-10-01",
  residente: { nome_completo: "Ana" }, medicamento: { nome: "Losartana" }, ...o,
});

describe("mapa de medicamentos do dia", () => {
  it("ordena horários e gera doses a cada X horas", () => {
    expect(horariosDaPrescricao(base())).toEqual(["08:00", "20:00"]);
    expect(horariosDaPrescricao(base({ horarios: [], frequencia_tipo: "a_cada_x_horas", frequencia_valor: 8 }))).toEqual(["00:00", "08:00", "16:00"]);
  });

  it("respeita vigência, dia da semana e intervalo de dias", () => {
    expect(prescricaoValeNoDia(base({ data_inicio: "2026-10-28" }), "2026-10-27")).toBe(false);
    expect(prescricaoValeNoDia(base({ data_fim: "2026-10-26" }), "2026-10-27")).toBe(false);
    // 27/10/2026 é terça (2)
    expect(prescricaoValeNoDia(base({ frequencia_tipo: "dia_especifico", dia_semana: 2 }), "2026-10-27")).toBe(true);
    expect(prescricaoValeNoDia(base({ frequencia_tipo: "dia_especifico", dia_semana: 3 }), "2026-10-27")).toBe(false);
    expect(prescricaoValeNoDia(base({ frequencia_tipo: "intervalo_dias", intervalo_dias: 2, data_inicio: "2026-10-25" }), "2026-10-27")).toBe(true);
    expect(prescricaoValeNoDia(base({ frequencia_tipo: "intervalo_dias", intervalo_dias: 2, data_inicio: "2026-10-26" }), "2026-10-27")).toBe(false);
  });

  it("classifica atrasado (>60 min), agora (±60 min) e próximo", () => {
    expect(statusDose("08:00", "09:01", false)).toBe("atrasado");
    expect(statusDose("08:00", "09:00", false)).toBe("agora");
    expect(statusDose("10:00", "09:00", false)).toBe("agora");
    expect(statusDose("10:01", "09:00", false)).toBe("proximo");
    expect(statusDose("08:00", "23:00", true)).toBe("administrado");
  });

  it("marca como administrada a dose já registrada e separa as sem horário", () => {
    const { doses, semHorario } = montarMapaDia(
      [base(), base({ id: "p2", horarios: [], frequencia_tipo: "hora_fixa_diaria" })],
      [{ residente_id: "r1", medicamento_id: "m1", horario_administracao: "08:00:00" }],
      "2026-10-27", "14:00",
    );
    expect(doses.map((d) => [d.horario, d.status])).toEqual([["08:00", "administrado"], ["20:00", "proximo"]]);
    expect(semHorario).toHaveLength(1);
    expect(resumoDoses(doses)).toMatchObject({ total: 2, administrado: 1, proximo: 1 });
  });
});
