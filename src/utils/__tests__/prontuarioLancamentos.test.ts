import { describe, expect, it } from "vitest";
import {
  cicloAceitaLancamento,
  consolidarLancamentos,
  hojeCicloISO,
  montarLinhaTempo,
  turnoDoHorario,
  type LancamentoProntuario,
} from "../prontuarioLancamentos";

// 05/09/2026 às 10:00 em Brasília (UTC-3) = 13:00 UTC
const AGORA = new Date("2026-09-05T13:00:00Z");

const base = (over: Partial<LancamentoProntuario>): LancamentoProntuario => ({
  id: "1",
  ciclo_id: "c1",
  residente_id: "r1",
  funcionario_id: "f1",
  tipo_registro: "lancamento",
  titulo: "Lançamento",
  descricao: "{}",
  created_at: "2026-09-05T13:00:00Z",
  ...over,
});

describe("janela do ciclo de 24h", () => {
  it("usa a data de Brasília mesmo perto da virada em UTC", () => {
    // 06/09 00:30 UTC ainda é 05/09 21:30 em Brasília
    expect(hojeCicloISO(new Date("2026-09-06T00:30:00Z"))).toBe("2026-09-05");
  });

  it("aceita lançamento no dia corrente e aberto", () => {
    expect(cicloAceitaLancamento("2026-09-05", "em_andamento", AGORA)).toBe(true);
  });

  it("bloqueia ciclo encerrado", () => {
    expect(cicloAceitaLancamento("2026-09-05", "encerrado", AGORA)).toBe(false);
  });

  it("bloqueia dias anteriores mesmo em andamento", () => {
    expect(cicloAceitaLancamento("2026-09-04", "em_andamento", AGORA)).toBe(false);
  });

  it("permite quando ainda não existe ciclo", () => {
    expect(cicloAceitaLancamento(null, null, AGORA)).toBe(true);
  });
});

describe("turno", () => {
  it("classifica 10h como diurno", () => {
    expect(turnoDoHorario("2026-09-05T13:00:00Z")).toBe("diurno");
  });

  it("classifica 22h como noturno", () => {
    expect(turnoDoHorario("2026-09-06T01:00:00Z")).toBe("noturno");
  });
});

describe("linha do tempo", () => {
  it("aninha retificações sob o registro original", () => {
    const linha = montarLinhaTempo([
      base({ id: "a", created_at: "2026-09-05T11:00:00Z" }),
      base({
        id: "b",
        tipo_registro: "retificacao",
        retifica_registro_id: "a",
        created_at: "2026-09-05T12:00:00Z",
      }),
      base({ id: "c", created_at: "2026-09-05T13:00:00Z" }),
    ]);

    expect(linha.map((l) => l.id)).toEqual(["a", "c"]);
    expect(linha[0].retificacoes.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignora tipos que não são lançamentos", () => {
    const linha = montarLinhaTempo([base({ id: "x", tipo_registro: "observacao_avulsa" })]);
    expect(linha).toHaveLength(0);
  });
});

describe("consolidação", () => {
  it("mantém o valor mais recente de cada campo", () => {
    const consolidado = consolidarLancamentos([
      base({ id: "a", descricao: '{"humor":"triste","dor":"3"}', created_at: "2026-09-05T11:00:00Z" }),
      base({ id: "b", descricao: '{"humor":"alegre"}', created_at: "2026-09-05T12:00:00Z" }),
    ]);

    expect(consolidado).toEqual({ humor: "alegre", dor: "3" });
  });
});
