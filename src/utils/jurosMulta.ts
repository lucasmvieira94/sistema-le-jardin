/**
 * Cálculo de juros de mora e multa por atraso em mensalidades.
 *
 * Padrão brasileiro (CDC art. 52 §1º — limite de multa de 2%):
 *  - Multa por atraso: percentual fixo aplicado sobre o saldo devedor, uma única vez.
 *  - Juros de mora: percentual ao mês, com cálculo pro-rata diário (% / 30 por dia).
 *
 * Ambos são configuráveis em `configuracoes_empresa`:
 *  - cobrar_juros_multa (liga/desliga)
 *  - multa_atraso_percentual (default 2,00%)
 *  - juros_mora_mensal_percentual (default 1,00% a.m. = ~0,0333% ao dia)
 *  - dias_carencia_atraso (dias de tolerância após o vencimento)
 */

export type ConfigJurosMulta = {
  cobrar_juros_multa: boolean;
  multa_atraso_percentual: number;
  juros_mora_mensal_percentual: number;
  dias_carencia_atraso: number;
};

export const CONFIG_PADRAO: ConfigJurosMulta = {
  cobrar_juros_multa: true,
  multa_atraso_percentual: 2,
  juros_mora_mensal_percentual: 1,
  dias_carencia_atraso: 0,
};

export type ResultadoJurosMulta = {
  diasAtraso: number;
  multa: number;
  juros: number;
  total: number; // multa + juros
};

function toDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  // Datas sem hora podem sofrer deslocamento por timezone — fixar no meio-dia.
  return new Date(d.length === 10 ? `${d}T12:00:00` : d);
}

function diffDias(a: Date, b: Date): number {
  const MS = 1000 * 60 * 60 * 24;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((ua - ub) / MS);
}

/**
 * Calcula multa + juros de mora sobre um saldo pendente.
 *
 * @param saldoPendente Valor sobre o qual incidem multa e juros (R$).
 * @param dataVencimento Data original do vencimento (ISO).
 * @param dataReferencia Data de referência do cálculo (geralmente hoje ou data do pagamento).
 * @param config Configuração do tenant (usa padrão se omitida).
 */
export function calcularJurosMulta(
  saldoPendente: number,
  dataVencimento: string | Date,
  dataReferencia: string | Date = new Date(),
  config: Partial<ConfigJurosMulta> = {},
): ResultadoJurosMulta {
  const cfg = { ...CONFIG_PADRAO, ...config };
  const venc = toDate(dataVencimento);
  const ref = toDate(dataReferencia);
  const diasBruto = diffDias(ref, venc);
  const diasAtraso = Math.max(0, diasBruto - (cfg.dias_carencia_atraso ?? 0));

  if (!cfg.cobrar_juros_multa || saldoPendente <= 0 || diasAtraso <= 0) {
    return { diasAtraso: Math.max(0, diasBruto), multa: 0, juros: 0, total: 0 };
  }

  const multa = +(saldoPendente * (Number(cfg.multa_atraso_percentual) / 100)).toFixed(2);
  const taxaDiaria = Number(cfg.juros_mora_mensal_percentual) / 100 / 30;
  const juros = +(saldoPendente * taxaDiaria * diasAtraso).toFixed(2);

  return { diasAtraso, multa, juros, total: +(multa + juros).toFixed(2) };
}
