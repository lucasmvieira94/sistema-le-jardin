/**
 * Calcula dias trabalhados no mês a partir da jornada da escala vigente.
 * Lógica baseada nas jornadas suportadas no sistema:
 *  - 12x36 → trabalha 1 dia, folga 1 dia (alternado)
 *  - 44h_8h_segsex_4h_sab → segunda a sábado
 *  - 36h_6h_seg_sab → segunda a sábado
 *  - default (40h_8h_segsex e similares) → segunda a sexta
 *
 * Para 12x36 considera o `data_inicio_vigencia` da escala como ponto de
 * referência para alternância. Caso ausente, usa o 1º dia do mês.
 */
export type JornadaTipo = string;

export interface CalcularDiasParams {
  ano: number;
  mes: number; // 1-12
  jornada: JornadaTipo;
  dataInicioVigencia?: string | null;
  dataAdmissao?: string | null;
  dataDesligamento?: string | null;
  /** Aviso prévio (CLT) — limita o VT ao último dia efetivamente trabalhado */
  avisoPrevio?: boolean | null;
  tipoAvisoPrevio?: string | null; // 'trabalhado' | 'indenizado' | 'dispensado'
  modalidadeReducaoAviso?: string | null; // 'reducao_2h_entrada' | 'reducao_2h_saida' | 'reducao_7_dias_corridos'
  dataInicioAviso?: string | null;
  dataFimAviso?: string | null;
}

function parseData(d?: string | null): Date | null {
  return d ? new Date(d + "T12:00:00") : null;
}

function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Último dia com direito a vale-transporte considerando o aviso prévio.
 * - trabalhado: até o último dia do aviso (data_fim_aviso).
 *   Se a redução escolhida for de 7 dias corridos, o último dia é antecipado em 7 dias.
 * - indenizado/dispensado: o funcionário não comparece durante o aviso,
 *   logo o último dia é o início do aviso (data_inicio_aviso).
 */
export function calcularUltimoDiaVT(p: CalcularDiasParams): Date | null {
  const desligamento = parseData(p.dataDesligamento);
  if (!p.avisoPrevio) return desligamento;

  const inicioAviso = parseData(p.dataInicioAviso);
  const fimAviso = parseData(p.dataFimAviso);
  let limiteAviso: Date | null = null;

  if (p.tipoAvisoPrevio === "indenizado" || p.tipoAvisoPrevio === "dispensado") {
    limiteAviso = inicioAviso ?? fimAviso;
  } else {
    // trabalhado (ou não informado): trabalha até o fim do aviso
    limiteAviso = fimAviso ?? inicioAviso;
    if (limiteAviso && p.modalidadeReducaoAviso === "reducao_7_dias_corridos") {
      limiteAviso = addDias(limiteAviso, -7);
    }
  }

  if (limiteAviso && desligamento) {
    return limiteAviso < desligamento ? limiteAviso : desligamento;
  }
  return limiteAviso ?? desligamento;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Para 12x36, conta dias considerando a paridade em relação ao início da vigência.
 * Funcionário trabalha em dias cuja diferença em dias para a referência é par.
 */
function calcular12x36(
  ano: number,
  mes: number,
  ref: Date,
  fim?: Date | null
): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    if (fim && data > fim) continue;
    const diff = Math.floor(
      (data.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0 && diff % 2 === 0) dias++;
  }
  return dias;
}

function calcularSegSex(ano: number, mes: number, inicio?: Date | null, fim?: Date | null): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    if (inicio && data < inicio) continue;
    if (fim && data > fim) continue;
    const dow = data.getDay(); // 0=dom, 6=sab
    if (dow >= 1 && dow <= 5) dias++;
  }
  return dias;
}

function calcularSegSab(ano: number, mes: number, inicio?: Date | null, fim?: Date | null): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    if (inicio && data < inicio) continue;
    if (fim && data > fim) continue;
    const dow = data.getDay();
    if (dow >= 1 && dow <= 6) dias++;
  }
  return dias;
}

export function calcularDiasTrabalhados(p: CalcularDiasParams): number {
  const inicio = p.dataInicioVigencia
    ? new Date(p.dataInicioVigencia + "T12:00:00")
    : p.dataAdmissao
    ? new Date(p.dataAdmissao + "T12:00:00")
    : null;

  // Limita o cálculo ao último dia efetivamente trabalhado (considera aviso prévio)
  const fim = calcularUltimoDiaVT(p);

  const jornada = (p.jornada || "").toLowerCase();

  if (jornada.includes("12x36")) {
    const ref = inicio ?? new Date(p.ano, p.mes - 1, 1);
    return calcular12x36(p.ano, p.mes, ref, fim);
  }

  if (jornada.includes("seg_sab") || jornada.includes("segsex_4h_sab")) {
    return calcularSegSab(p.ano, p.mes, inicio, fim);
  }

  // Default: segunda a sexta
  return calcularSegSex(p.ano, p.mes, inicio, fim);
}

export function nomeMes(mes: number): string {
  return [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ][mes - 1];
}