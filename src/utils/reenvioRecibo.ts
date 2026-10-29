import type { ReciboPagamento, ReciboResultado } from "./reciboPDF";

export type TentativaRecibo = {
  dados: ReciboPagamento;
  recibo?: ReciboResultado;
};

export function podeReenviarRecibo(pagamento: { status: string; valor_pago: number }) {
  return pagamento.status !== "cancelado" && Number(pagamento.valor_pago) > 0;
}

/** Mantém o PDF certificado e o valor desta parcela entre tentativas de envio. */
export async function enviarTentativaRecibo(
  tentativa: TentativaRecibo,
  gerar: (dados: ReciboPagamento) => Promise<ReciboResultado>,
  enviar: (recibo: ReciboResultado, dados: ReciboPagamento) => Promise<void>,
) {
  tentativa.recibo ??= await gerar(tentativa.dados);
  await enviar(tentativa.recibo, tentativa.dados);
}