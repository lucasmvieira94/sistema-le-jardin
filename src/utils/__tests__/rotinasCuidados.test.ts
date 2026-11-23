import { describe, expect, it } from "vitest";
import { fimPorDuracao, ocorrenciasDoDia, orientacoesVigentes, rotinaSchema, vigenteEm, type RotinaCuidado } from "../rotinasCuidados";

const base: RotinaCuidado = { id: "r1", residente_id: "x", residente_nome: "Ana", titulo: "Pressão", tipo: "afericao", instrucoes: null,
  frequencia: "horarios", horarios: ["08:00:00", "14:00:00", "20:00:00"], momento: null, tipo_afericao: "pressao", dias_semana: [],
  inicio: "2026-11-10", fim: "2026-11-16", encerrada_em: null, motivo_encerramento: null, criado_por_nome: null };

describe("rotinas de cuidado", () => {
  it("pressão 3x ao dia gera 3 ocorrências dentro da vigência", () => {
    expect(ocorrenciasDoDia([base], [], "2026-11-14", 0)).toHaveLength(3);
    expect(ocorrenciasDoDia([base], [], "2026-11-17", 0)).toHaveLength(0);
  });
  it("status: atrasado após 1h, agora dentro da janela, feito quando registrado", () => {
    const ex = [{ id: "e", rotina_id: "r1", data: "2026-11-14", chave: "14:00", feito_em: "", feito_por_nome: "B", valor: "12x8", observacao: null, titulo: "", tipo_afericao: null, residente_id: "x" }];
    const o = ocorrenciasDoDia([base], ex, "2026-11-14", 14 * 60 + 30);
    expect(o.map((x) => x.status)).toEqual(["atrasado", "feito", "proximo"]);
    expect(ocorrenciasDoDia([base], [], "2026-11-14", 19 * 60 + 30)[2].status).toBe("agora");
  });
  it("orientação de banho não gera registro, só lembrete", () => {
    const o = { ...base, tipo: "orientacao" as const, frequencia: "momento" as const, momento: "banho", horarios: [], fim: null };
    expect(ocorrenciasDoDia([o], [], "2026-11-14", 0)).toHaveLength(0);
    expect(orientacoesVigentes([o], "2026-11-14")).toHaveLength(1);
  });
  it("plantão gera diurno e noturno; dias da semana filtram", () => {
    expect(ocorrenciasDoDia([{ ...base, frequencia: "plantao" }], [], "2026-11-14", 0)).toHaveLength(3);
    expect(vigenteEm({ ...base, dias_semana: [1] }, "2026-11-14")).toBe(false); // sábado
    expect(vigenteEm({ ...base, encerrada_em: "x" }, "2026-11-14")).toBe(false);
  });
  it("curativo por 10 dias termina no 10º dia", () => { expect(fimPorDuracao("2026-11-14", 10)).toBe("2026-11-23"); });
  it("às 02h o plantão pertence à noite anterior, sem concluir a próxima noite", () => {
    const r = { ...base, frequencia: "plantao" as const };
    const ex = [{ id: "e", rotina_id: r.id, data: "2026-11-13", chave: "noturno", feito_em: "2026-11-14T05:00:00Z", feito_por_nome: "B", valor: "12x8", observacao: null, titulo: "", tipo_afericao: null, residente_id: "x" }];
    const noites = ocorrenciasDoDia([r], ex, "2026-11-14", 120).filter(o => o.chave === "noturno");
    expect(noites.map(o => [o.data, o.status])).toEqual([["2026-11-13", "feito"], ["2026-11-14", "proximo"]]);
    expect(ocorrenciasDoDia([r], ex, "2026-11-14", 19 * 60).find(o => o.chave === "noturno")?.status).toBe("agora");
  });
  it("vigência e dia da semana do plantão noturno seguem o início da noite", () => {
    const r = { ...base, frequencia: "plantao" as const, fim: "2026-11-13", dias_semana: [5] };
    expect(ocorrenciasDoDia([r], [], "2026-11-14", 6 * 60 + 59).map(o => o.data)).toEqual(["2026-11-13"]);
    expect(ocorrenciasDoDia([r], [], "2026-11-14", 7 * 60)).toHaveLength(0);
  });
  it("bloqueia remédio e exige horário", () => {
    const v = { residente: "00000000-0000-4000-8000-000000000000", titulo: "Dar dipirona", tipo: "procedimento", instrucoes: "", frequencia: "horarios", horarios: [], momento: null, tipo_afericao: null, dias_semana: [], inicio: "2026-11-14", fim: null };
    const msgs = rotinaSchema.safeParse(v).error!.issues.map((i) => i.message);
    expect(msgs).toContain("Remédios são cadastrados no Mapa de Medicamentos");
    expect(msgs).toContain("Informe ao menos um horário");
  });
});
