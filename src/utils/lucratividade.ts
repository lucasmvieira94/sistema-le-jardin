export type RecebimentoLucratividade = {
  competencia: string;
  valor_pago: number;
  status: string;
};

export type PagamentoLucratividade = {
  valor: number;
  data_pagamento: string | null;
  status: string;
};

/**
 * Soma somente movimentações financeiras efetivadas.
 * Registros cancelados ficam fora do balanço mesmo que ainda possuam valor ou data de pagamento.
 */
export function calcularMovimentoMensal(
  recebimentos: RecebimentoLucratividade[],
  pagamentos: PagamentoLucratividade[],
  competencia: string,
) {
  const receita = recebimentos
    .filter((item) => item.status !== "cancelado" && item.competencia.slice(0, 7) === competencia)
    .reduce((total, item) => total + Number(item.valor_pago || 0), 0);

  const despesa = pagamentos
    .filter(
      (item) =>
        item.status === "pago" &&
        item.data_pagamento?.slice(0, 7) === competencia,
    )
    .reduce((total, item) => total + Number(item.valor || 0), 0);

  return { receita, despesa, lucro: receita - despesa };
}