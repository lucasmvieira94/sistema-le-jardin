import { describe, expect, it } from "vitest";
import { criarValoresIniciaisAfastamento } from "../afastamentoForm";

describe("criarValoresIniciaisAfastamento", () => {
  it("deixa o formulário pronto para um novo afastamento em dias", () => {
    expect(criarValoresIniciaisAfastamento()).toEqual({
      funcionario_id: "",
      tipo_afastamento_id: "",
      tipo_periodo: "dias",
      data_inicio: "",
      hora_inicio: "",
      quantidade_horas: undefined,
      quantidade_dias: undefined,
      observacoes: "",
    });
  });

  it("retorna um novo objeto a cada reinicialização", () => {
    const primeiro = criarValoresIniciaisAfastamento();
    const segundo = criarValoresIniciaisAfastamento();

    primeiro.funcionario_id = "funcionario-anterior";

    expect(segundo.funcionario_id).toBe("");
  });
});