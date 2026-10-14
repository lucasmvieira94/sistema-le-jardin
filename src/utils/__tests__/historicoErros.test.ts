import { describe, it, expect } from "vitest";
import { filtrarErros, resumoPorModulo, ErroSistema } from "../historicoErros";

const base = (o: Partial<ErroSistema>): ErroSistema => ({
  id: Math.random().toString(), origem: "Financeiro", erro: "x", diagnostico: null, sugestao: null,
  gravidade: "media", resolvido: false, created_at: "2026-10-10T15:00:00.000Z", ...o,
});
const lista = [
  base({ origem: "Financeiro", gravidade: "alta" }),
  base({ origem: "Prontuário", resolvido: true }),
  base({ origem: "Prontuário", created_at: "2026-10-12T02:30:00.000Z" }), // 11/10 23:30 em Brasília
];
const todos = { modulo: "todos", gravidade: "todas", status: "todos" as const };

describe("histórico de erros", () => {
  it("filtra por módulo, gravidade e status", () => {
    expect(filtrarErros(lista, { ...todos, modulo: "Prontuário" })).toHaveLength(2);
    expect(filtrarErros(lista, { ...todos, gravidade: "alta" })).toHaveLength(1);
    expect(filtrarErros(lista, { ...todos, status: "resolvidos" })).toHaveLength(1);
    expect(filtrarErros(lista, { ...todos, status: "abertos" })).toHaveLength(2);
  });
  it("usa o dia de Brasília no período", () => {
    expect(filtrarErros(lista, { ...todos, de: "2026-10-11", ate: "2026-10-11" })).toHaveLength(1);
  });
  it("resume por módulo com mais abertos primeiro (empate: mais ocorrências)", () => {
    const r = resumoPorModulo(lista);
    expect(r[1]).toMatchObject({ modulo: "Financeiro", abertos: 1, altas: 1 });
    expect(r[0]).toMatchObject({ modulo: "Prontuário", total: 2, abertos: 1 });
  });
});
