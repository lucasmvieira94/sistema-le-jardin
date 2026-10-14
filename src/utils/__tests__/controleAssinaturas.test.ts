import { describe, it, expect } from "vitest";
import { venceEmBreve, estaAtrasado, filtrarAssinaturas, resumirAssinaturas, pendenciasPorColaborador, LinhaAssinatura } from "../controleAssinaturas";

const AGORA = new Date("2026-10-14T12:00:00Z").getTime();
const l = (o: Partial<LinhaAssinatura>): LinhaAssinatura => ({
  funcionario_id: "a", funcionario_nome: "Ana", funcao: null, tipo_documento: "folha_ponto", referencia_id: Math.random().toString(),
  titulo: "Folha de ponto 09/2026", subtitulo: null, criado_em: "2026-10-13T12:00:00Z", status: "pendente",
  assinado_em: null, motivo_recusa: null, hash_assinatura: null, ...o,
});
const lista = [
  l({}),
  l({ criado_em: "2026-10-01T12:00:00Z" }), // pendente há 13 dias → atrasado
  l({ funcionario_id: "b", funcionario_nome: "Bruno", status: "assinado", tipo_documento: "comunicado", titulo: "Regimento" }),
  l({ funcionario_id: "b", funcionario_nome: "Bruno", status: "recusado" }),
];

describe("controle de assinaturas", () => {
  it("pendente há mais de 3 dias fica atrasado", () => {
    expect(estaAtrasado(l({ criado_em: "2026-10-11T11:00:00Z" }), AGORA)).toBe(true);
    expect(estaAtrasado(l({ criado_em: "2026-10-11T13:00:00Z" }), AGORA)).toBe(false);
    expect(estaAtrasado(l({ status: "assinado", criado_em: "2026-01-01T00:00:00Z" }), AGORA)).toBe(false);
  });
  it("prazo próprio do documento prevalece sobre o padrão", () => {
    expect(estaAtrasado(l({ criado_em: "2026-10-01T12:00:00Z", prazo_em: "2026-10-20T02:59:59Z" }), AGORA)).toBe(false);
    expect(estaAtrasado(l({ criado_em: "2026-10-13T12:00:00Z", prazo_em: "2026-10-14T11:00:00Z" }), AGORA)).toBe(true);
  });
  it("avisa quando falta 1 dia ou menos", () => {
    expect(venceEmBreve(l({ prazo_em: "2026-10-15T10:00:00Z" }), AGORA)).toBe(true);
    expect(venceEmBreve(l({ prazo_em: "2026-10-16T13:00:00Z" }), AGORA)).toBe(false);
    expect(venceEmBreve(l({ prazo_em: "2026-10-14T11:00:00Z" }), AGORA)).toBe(false);
  });
  it("resume e calcula o percentual assinado", () => {
    expect(resumirAssinaturas(lista, AGORA)).toEqual({ total: 4, pendentes: 2, atrasados: 1, assinados: 1, recusados: 1, percentual: 25 });
  });
  it("filtra por situação, tipo e busca", () => {
    const f = { busca: "", tipo: "todos", situacao: "todas" as const };
    expect(filtrarAssinaturas(lista, { ...f, situacao: "atrasado" }, AGORA)).toHaveLength(1);
    expect(filtrarAssinaturas(lista, { ...f, tipo: "comunicado" }, AGORA)).toHaveLength(1);
    expect(filtrarAssinaturas(lista, { ...f, busca: "bruno" }, AGORA)).toHaveLength(2);
  });
  it("lista colaboradores com pendências, atrasados primeiro", () => {
    const p = pendenciasPorColaborador(lista, AGORA);
    expect(p[0]).toMatchObject({ nome: "Ana", pendentes: 2, atrasados: 1 });
    expect(p[1]).toMatchObject({ nome: "Bruno", pendentes: 0, recusados: 1 });
  });
});
