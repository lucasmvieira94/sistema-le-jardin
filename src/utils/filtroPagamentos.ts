export type MeioPagamento = "pix" | "dinheiro" | "transferencia" | "cartao";

type PagamentoFiltravel = {
  status: string;
  forma_pagamento: string | null;
};

/** Aplica conjuntamente os filtros de status e meio de pagamento. */
export function filtrarPagamentos<T extends PagamentoFiltravel>(
  pagamentos: T[],
  status: string,
  meioPagamento: "todos" | MeioPagamento,
): T[] {
  return pagamentos.filter((pagamento) => {
    const correspondeAoStatus = status === "todos" || pagamento.status === status;
    const correspondeAoMeio =
      meioPagamento === "todos" || pagamento.forma_pagamento === meioPagamento;

    return correspondeAoStatus && correspondeAoMeio;
  });
}