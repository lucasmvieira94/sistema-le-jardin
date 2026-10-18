/**
 * Regras de cálculo do distrato de contrato de residente (Cláusula Sexta do contrato).
 * Funções puras, sem acesso ao banco, para poderem ser testadas isoladamente.
 * Datas no formato YYYY-MM-DD; o cálculo usa meio-dia UTC para evitar troca de dia por fuso.
 */

export type TipoRescisao =
  | "aviso_previo"
  | "sem_aviso"
  | "unilateral_I"
  | "unilateral_II"
  | "unilateral_III"
  | "falecimento"
  | "adaptacao"
  | "acordo";

export type ParteRescisao = "contratante" | "contratada";

export const AVISO_PREVIO_DIAS = 30;
export const ADAPTACAO_DIAS = 10;
export const ADAPTACAO_TAXA_DIA = 250;

export const TIPOS_RESCISAO: { valor: TipoRescisao; rotulo: string; clausula: string; descricao: string }[] = [
  { valor: "aviso_previo", rotulo: "Por qualquer das partes, com aviso prévio de 30 dias", clausula: "Cláusula 6", descricao: "O contrato se encerra 30 dias após a data do distrato." },
  { valor: "sem_aviso", rotulo: "Sem cumprimento do aviso prévio", clausula: "Cláusula 6.1", descricao: "Encerramento imediato; a parte que rescindiu indeniza a outra em uma mensalidade." },
  { valor: "unilateral_I", rotulo: "Unilateral — atraso de pagamento superior a 30 dias", clausula: "Cláusula 6.2, I", descricao: "Encerramento imediato, sem devolução da garantia." },
  { valor: "unilateral_II", rotulo: "Unilateral — descumprimento de cláusula contratual", clausula: "Cláusula 6.2, II", descricao: "Encerramento imediato, sem devolução da garantia." },
  { valor: "unilateral_III", rotulo: "Unilateral — nova AGDI / mudança do grau de dependência", clausula: "Cláusula 6.2, III", descricao: "Contrato extinto automaticamente." },
  { valor: "falecimento", rotulo: "Falecimento", clausula: "Cláusula 6.3", descricao: "Rescisão de pleno direito; é devido o mês do falecimento." },
  { valor: "adaptacao", rotulo: "Durante o período de adaptação (10 dias)", clausula: "Período de adaptação", descricao: "Cobra R$ 250,00 por dia utilizado." },
  { valor: "acordo", rotulo: "Condição acordada entre as partes", clausula: "Acordo entre as partes", descricao: "Condição e valores escritos livremente." },
];

export interface EntradaDistrato {
  tipo: TipoRescisao;
  valorMensalidade: number;
  dataInicioContrato: string;
  dataDistrato: string;
  parteIniciadora?: ParteRescisao;
  /** Somente para "acordo". */
  dataEfetivaAcordo?: string;
  valorAcordo?: number;
  /** Mensalidades em aberto a incluir no distrato. */
  pendencias?: number;
}

export interface ResultadoDistrato {
  dataEfetiva: string;
  valorProporcional: number;
  valorIndenizacao: number;
  /** Quem paga a indenização (quando houver). */
  indenizacaoPagaPor: ParteRescisao | null;
  valorAdaptacao: number;
  diasAdaptacao: number;
  valorPendencias: number;
  retemGarantia: boolean;
  /** Saldo devido pelo contratante (negativo = a contratada deve ao contratante). */
  valorTotal: number;
}

const DIA_MS = 86_400_000;
const paraData = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const paraISO = (d: Date) => d.toISOString().slice(0, 10);
const arred = (v: number) => Math.round(v * 100) / 100;

export function somarDias(iso: string, dias: number): string {
  return paraISO(new Date(paraData(iso).getTime() + dias * DIA_MS));
}

export function diasNoMes(iso: string): number {
  const d = paraData(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Mensalidade proporcional do dia 1 até a data (inclusive), por dias corridos do mês. */
export function proporcionalAte(iso: string, mensalidade: number): number {
  return arred((mensalidade * paraData(iso).getUTCDate()) / diasNoMes(iso));
}

export function calcularDistrato(e: EntradaDistrato): ResultadoDistrato {
  const pend = arred(e.pendencias ?? 0);
  const base: ResultadoDistrato = {
    dataEfetiva: e.dataDistrato,
    valorProporcional: 0,
    valorIndenizacao: 0,
    indenizacaoPagaPor: null,
    valorAdaptacao: 0,
    diasAdaptacao: 0,
    valorPendencias: pend,
    retemGarantia: false,
    valorTotal: 0,
  };

  switch (e.tipo) {
    case "aviso_previo":
      base.dataEfetiva = somarDias(e.dataDistrato, AVISO_PREVIO_DIAS);
      base.valorProporcional = proporcionalAte(base.dataEfetiva, e.valorMensalidade);
      break;
    case "sem_aviso":
      base.valorProporcional = proporcionalAte(e.dataDistrato, e.valorMensalidade);
      base.valorIndenizacao = arred(e.valorMensalidade);
      base.indenizacaoPagaPor = e.parteIniciadora ?? "contratante";
      break;
    case "unilateral_I":
    case "unilateral_II":
      base.valorProporcional = proporcionalAte(e.dataDistrato, e.valorMensalidade);
      base.retemGarantia = true;
      break;
    case "unilateral_III":
      base.valorProporcional = proporcionalAte(e.dataDistrato, e.valorMensalidade);
      break;
    case "falecimento":
      base.valorProporcional = arred(e.valorMensalidade);
      break;
    case "adaptacao": {
      const usados = Math.round((paraData(e.dataDistrato).getTime() - paraData(e.dataInicioContrato).getTime()) / DIA_MS) + 1;
      base.diasAdaptacao = Math.min(Math.max(usados, 0), ADAPTACAO_DIAS);
      base.valorAdaptacao = base.diasAdaptacao * ADAPTACAO_TAXA_DIA;
      break;
    }
    case "acordo":
      base.dataEfetiva = e.dataEfetivaAcordo || e.dataDistrato;
      base.valorProporcional = arred(e.valorAcordo ?? 0);
      break;
  }

  const indenizacaoAssinada =
    base.indenizacaoPagaPor === "contratada" ? -base.valorIndenizacao : base.valorIndenizacao;
  base.valorTotal = arred(base.valorProporcional + indenizacaoAssinada + base.valorAdaptacao + pend);
  return base;
}

export function rotuloTipo(tipo: string): string {
  return TIPOS_RESCISAO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}
export function clausulaTipo(tipo: string): string {
  return TIPOS_RESCISAO.find((t) => t.valor === tipo)?.clausula ?? "";
}
