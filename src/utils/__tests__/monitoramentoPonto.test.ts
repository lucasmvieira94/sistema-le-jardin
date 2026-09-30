import { describe, expect, it } from "vitest";
import {
  analisarPonto,
  contarPorTipo,
  estaEmFolga,
  exigeComprovante,
  type EntradaMonitoramento,
  type FuncionarioMonit,
} from "../monitoramentoPonto";

// 10/09/2026 (quinta) 15h00 em Brasília
const AGORA = new Date("2026-09-10T18:00:00Z");

const diurno: FuncionarioMonit = {
  id: "f1", nome_completo: "Ana", data_inicio_vigencia: "2026-01-01",
  escala: { entrada: "08:00", saida: "17:00", jornada_trabalho: "5x2", intervalo_pre_assinalado: false, intervalo_minutos: 60 },
};

const base = (over: Partial<EntradaMonitoramento> = {}): EntradaMonitoramento => ({
  funcionarios: [diurno], registros: [], afastamentos: [], justificativas: new Set(),
  folhas: [{ funcionario_id: "f1", mes: 8, ano: 2026, confirmado: true }], dias: 1, agora: AGORA, ...over,
});

const tipos = (e: EntradaMonitoramento) => analisarPonto(e).map((p) => `${p.tipo}@${p.data}`);

describe("monitoramento do ponto", () => {
  it("aponta falta não justificada em dia de escala sem registro", () => {
    expect(tipos(base())).toEqual(["falta_nao_justificada@2026-09-10", "falta_nao_justificada@2026-09-09"]);
  });

  it("afastamento cobre a falta", () => {
    const r = tipos(base({ afastamentos: [{ id: "a", funcionario_id: "f1", data_inicio: "2026-09-09", data_fim: "2026-09-10", tipo_descricao: "Folga compensatória" }] }));
    expect(r).toEqual([]);
  });

  it("afastamento médico sem anexo é cobrado", () => {
    const r = tipos(base({ afastamentos: [{ id: "a", funcionario_id: "f1", data_inicio: "2026-09-09", data_fim: "2026-09-10", tipo_descricao: "Atestado médico" }] }));
    expect(r).toEqual(["afastamento_sem_anexo@2026-09-09"]);
  });

  it("saída só é cobrada 2h após o fim do turno", () => {
    const reg = { funcionario_id: "f1", entrada: "08:00", saida: null, intervalos_pausas: [{ inicio: "12:00", fim: "13:00" }] };
    const r = tipos(base({ registros: [{ ...reg, data: "2026-09-09" }, { ...reg, data: "2026-09-10" }] }));
    expect(r).toEqual(["saida_nao_registrada@2026-09-09"]);
  });

  it("turno noturno vira o dia antes de cobrar a saída", () => {
    const noturno: FuncionarioMonit = { ...diurno, escala: { ...diurno.escala!, entrada: "20:00", saida: "08:00", jornada_trabalho: "outro", intervalo_pre_assinalado: true } };
    const r = tipos(base({
      funcionarios: [noturno],
      // 10/09 07h30 BR: turno de 09/09 ainda não terminou + 2h
      agora: new Date("2026-09-10T10:30:00Z"),
      registros: [{ funcionario_id: "f1", data: "2026-09-09", entrada: "20:00", saida: null }],
    }));
    expect(r).not.toContain("saida_nao_registrada@2026-09-09");
  });

  it("atraso sem justificativa e intervalo ausente", () => {
    const r = tipos(base({ dias: 1, registros: [
      { funcionario_id: "f1", data: "2026-09-09", entrada: "08:40", saida: "17:00" },
      { funcionario_id: "f1", data: "2026-09-10", entrada: "08:00", saida: null },
    ] }));
    expect(r).toContain("atraso_sem_justificativa@2026-09-09");
    expect(r).toContain("intervalo_irregular@2026-09-09");
  });

  it("justificativa enviada remove o atraso", () => {
    const r = tipos(base({ justificativas: new Set(["f1|2026-09-09"]), registros: [
      { funcionario_id: "f1", data: "2026-09-09", entrada: "08:40", saida: "17:00", intervalo_inicio: "12:00", intervalo_fim: "13:00" },
      { funcionario_id: "f1", data: "2026-09-10", entrada: "08:00", saida: null },
    ] }));
    expect(r).toEqual([]);
  });

  it("registro em dia de folga é marcado como fora da escala", () => {
    const r = tipos(base({ dias: 5, agora: new Date("2026-09-07T18:00:00Z"), registros: [
      { funcionario_id: "f1", data: "2026-09-06", entrada: "08:00", saida: "12:00" },
    ] }));
    expect(r).toContain("fora_da_escala@2026-09-06");
  });

  it("cobra folha do mês anterior não publicada e não confirmada", () => {
    expect(tipos(base({ dias: 0, folhas: [], registros: [{ funcionario_id: "f1", data: "2026-09-10", entrada: "08:00", saida: null }] })))
      .toEqual(["folha_nao_publicada@2026-08-01"]);
    expect(tipos(base({ dias: 0, folhas: [{ funcionario_id: "f1", mes: 8, ano: 2026, confirmado: false }], registros: [{ funcionario_id: "f1", data: "2026-09-10", entrada: "08:00", saida: null }] })))
      .toEqual(["folha_nao_confirmada@2026-08-01"]);
  });

  it("usa o dia de Brasília na virada UTC", () => {
    // 11/09 01h UTC = 10/09 22h BR
    const r = tipos(base({ dias: 0, agora: new Date("2026-09-11T01:00:00Z") }));
    expect(r).toEqual(["falta_nao_justificada@2026-09-10"]);
  });

  it("regras auxiliares", () => {
    expect(estaEmFolga("5x2", "2026-01-01", "2026-09-06")).toBe(true);
    expect(estaEmFolga("12x36", "2026-09-01", "2026-09-02")).toBe(true);
    expect(exigeComprovante("Licença maternidade")).toBe(true);
    expect(exigeComprovante("Folga")).toBe(false);
    expect(contarPorTipo(analisarPonto(base())).falta_nao_justificada).toBe(2);
  });
});
