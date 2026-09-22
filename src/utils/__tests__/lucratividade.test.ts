import { describe, expect, it } from "vitest";
import { calcularMovimentoMensal } from "@/utils/lucratividade";

describe("calcularMovimentoMensal", () => {
  it("exclui recebimentos cancelados mesmo quando conservam valor recebido", () => {
    const resultado = calcularMovimentoMensal(
      [
        { competencia: "2026-09-01", valor_pago: 1_500, status: "pago" },
        { competencia: "2026-09-01", valor_pago: 2_000, status: "cancelado" },
      ],
      [],
      "2026-09",
    );

    expect(resultado).toEqual({ receita: 1_500, despesa: 0, lucro: 1_500 });
  });

  it("exclui pagamentos cancelados mesmo quando conservam data e valor", () => {
    const resultado = calcularMovimentoMensal(
      [],
      [
        { valor: 400, data_pagamento: "2026-09-10", status: "pago" },
        { valor: 900, data_pagamento: "2026-09-11", status: "cancelado" },
      ],
      "2026-09",
    );

    expect(resultado).toEqual({ receita: 0, despesa: 400, lucro: -400 });
  });

  it("não inclui movimentações de outra competência", () => {
    const resultado = calcularMovimentoMensal(
      [{ competencia: "2026-08-01", valor_pago: 700, status: "pago" }],
      [{ valor: 300, data_pagamento: "2026-08-20", status: "pago" }],
      "2026-09",
    );

    expect(resultado).toEqual({ receita: 0, despesa: 0, lucro: 0 });
  });
});