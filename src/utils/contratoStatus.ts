/**
 * Regras de status de contrato de residente.
 *
 * Um residente pode ter vários contratos; consideramos sempre o contrato
 * "vigente" (ativo mais recente). A partir da data de fim calculamos:
 *  - em_dia            → vence em mais de 60 dias (ou sem data de término)
 *  - proximo_renovacao → vence nos próximos 60 dias
 *  - vencido           → data de término já passou
 *  - sem_contrato      → nenhum contrato ativo cadastrado
 */

export const DIAS_ALERTA_RENOVACAO = 60;

export type ContratoStatusKey =
  | "em_dia"
  | "proximo_renovacao"
  | "vencido"
  | "sem_contrato";

export interface ContratoResumo {
  id: string;
  residente_id: string;
  numero_contrato: string;
  status: string;
  data_inicio_contrato: string;
  data_fim_contrato?: string | null;
}

export interface ContratoStatusInfo {
  key: ContratoStatusKey;
  label: string;
  /** Dias restantes até o fim do contrato (negativo se vencido, null se indeterminado) */
  diasRestantes: number | null;
  contrato: ContratoResumo | null;
}

const LABELS: Record<ContratoStatusKey, string> = {
  em_dia: "Em dia",
  proximo_renovacao: "Próximo de renovação",
  vencido: "Vencido",
  sem_contrato: "Sem contrato",
};

/** Data (UTC-3) no formato YYYY-MM-DD */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(agora);
}

function diffDias(dataFimISO: string, hoje: string): number {
  const fim = new Date(`${dataFimISO}T12:00:00`).getTime();
  const ref = new Date(`${hoje}T12:00:00`).getTime();
  return Math.round((fim - ref) / 86_400_000);
}

/** Seleciona o contrato vigente (ativo com término mais distante / mais recente). */
export function selecionarContratoVigente(
  contratos: ContratoResumo[]
): ContratoResumo | null {
  const ativos = contratos.filter((c) => c.status === "ativo");
  if (ativos.length === 0) return null;

  return [...ativos].sort((a, b) => {
    const fa = a.data_fim_contrato ?? "9999-12-31";
    const fb = b.data_fim_contrato ?? "9999-12-31";
    if (fa !== fb) return fa < fb ? 1 : -1;
    return a.data_inicio_contrato < b.data_inicio_contrato ? 1 : -1;
  })[0];
}

export function calcularStatusContrato(
  contratos: ContratoResumo[],
  hoje: string = hojeISO()
): ContratoStatusInfo {
  const contrato = selecionarContratoVigente(contratos);

  if (!contrato) {
    return { key: "sem_contrato", label: LABELS.sem_contrato, diasRestantes: null, contrato: null };
  }

  if (!contrato.data_fim_contrato) {
    return { key: "em_dia", label: LABELS.em_dia, diasRestantes: null, contrato };
  }

  const dias = diffDias(contrato.data_fim_contrato, hoje);
  const key: ContratoStatusKey =
    dias < 0 ? "vencido" : dias <= DIAS_ALERTA_RENOVACAO ? "proximo_renovacao" : "em_dia";

  return { key, label: LABELS[key], diasRestantes: dias, contrato };
}

/** Classes utilitárias para o Badge de cada status. */
export const CONTRATO_STATUS_CLASSES: Record<ContratoStatusKey, string> = {
  em_dia: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  proximo_renovacao: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  vencido: "bg-red-500/10 text-red-700 border-red-500/30",
  sem_contrato: "bg-muted text-muted-foreground border-border",
};
