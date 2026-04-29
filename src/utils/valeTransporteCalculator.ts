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
  ref: Date
): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    const diff = Math.floor(
      (data.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0 && diff % 2 === 0) dias++;
  }
  return dias;
}

function calcularSegSex(ano: number, mes: number, inicio?: Date | null): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    if (inicio && data < inicio) continue;
    const dow = data.getDay(); // 0=dom, 6=sab
    if (dow >= 1 && dow <= 5) dias++;
  }
  return dias;
}

function calcularSegSab(ano: number, mes: number, inicio?: Date | null): number {
  const total = diasNoMes(ano, mes);
  let dias = 0;
  for (let d = 1; d <= total; d++) {
    const data = new Date(ano, mes - 1, d);
    if (inicio && data < inicio) continue;
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

  const jornada = (p.jornada || "").toLowerCase();

  if (jornada.includes("12x36")) {
    const ref = inicio ?? new Date(p.ano, p.mes - 1, 1);
    // Limitar referência ao início do mês se vigência for anterior
    const refMes = ref < new Date(p.ano, p.mes - 1, 1) ? ref : ref;
    return calcular12x36(p.ano, p.mes, refMes);
  }

  if (jornada.includes("seg_sab") || jornada.includes("segsex_4h_sab")) {
    return calcularSegSab(p.ano, p.mes, inicio);
  }

  // Default: segunda a sexta
  return calcularSegSex(p.ano, p.mes, inicio);
}

export function nomeMes(mes: number): string {
  return [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ][mes - 1];
}