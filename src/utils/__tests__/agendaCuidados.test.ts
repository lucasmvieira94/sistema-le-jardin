import { describe, expect, it } from "vitest";
import { avisosAgenda, eventoCuidadosSchema, type EventoCuidados } from "../agendaCuidados";

const evento: EventoCuidados = { id: "1", residente_id: "r", residente_nome: "Exemplo", titulo: "Consulta médica", data_evento: "2026-11-07", horario: "09:00:00", observacoes: "Levar exames", visto_em: null, visto_por_nome: null };
describe("agenda de cuidados", () => {
  it("avisa somente compromissos pendentes do dia, inclusive horários já passados", () => {
    expect(avisosAgenda([evento, { ...evento, id: "2", data_evento: "2026-11-08" }], "2026-11-07")).toEqual([evento]);
  });
  it("uma confirmação elimina o aviso para qualquer cuidador sem retirar o evento da agenda", () => {
    const eventos = [{ ...evento, visto_em: "2026-11-07T12:00:00Z", visto_por_nome: "Cuidador" }];
    expect(avisosAgenda(eventos, "2026-11-07")).toEqual([]);
    expect(eventos).toHaveLength(1);
  });
  it("exige residente, título, data válida e horário e aceita observações", () => {
    const form = { residente: "00000000-0000-4000-8000-000000000001", titulo: "Consulta médica", data: "2026-11-07", horario: "09:00", observacoes: "Levar exames" };
    expect(eventoCuidadosSchema.safeParse(form).success).toBe(true);
    for (const invalido of [{ residente: "" }, { titulo: " " }, { data: "2026-02-30" }, { horario: "25:00" }]) {
      expect(eventoCuidadosSchema.safeParse({ ...form, ...invalido }).success).toBe(false);
    }
  });
});