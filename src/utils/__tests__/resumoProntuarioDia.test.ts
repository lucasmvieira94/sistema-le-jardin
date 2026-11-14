import { describe, expect, it } from "vitest";
import { dadosParaResumo, type RegistroDia } from "../../../supabase/functions/resumo-prontuario-dia/dados";

const registro: RegistroDia = { id: "registro-1", data_registro: "2026-11-14", horario_registro: "08:00", tipo_registro: "observacao", titulo: "Cuidados", descricao: "Curativo realizado", observacoes: "Sem sangramento", funcionario_nome: "Cuidadora" };
describe("resumo do prontuário diário", () => {
  it("analisa somente o dia solicitado, sem misturar dias anteriores", () => {
    expect(dadosParaResumo([registro, { ...registro, id: "registro-2", data_registro: "2026-11-13" }], "2026-11-14").map((r) => r.id)).toEqual(["registro-1"]);
  });
  it("preserva observações e retificações para a análise fiel", () => {
    const dados = dadosParaResumo([{ ...registro, retifica_registro_id: "original", justificativa_retificacao: "Correção da aferição" }], "2026-11-14");
    expect(dados[0]).toMatchObject({ descricao: "Curativo realizado", observacoes: "Sem sangramento", retifica_registro_id: "original", justificativa_retificacao: "Correção da aferição" });
  });
  it("não envia a identidade do cuidador ao modelo", () => {
    expect(dadosParaResumo([registro], "2026-11-14")[0]).not.toHaveProperty("funcionario_nome");
  });
});