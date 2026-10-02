/**
 * Escala vigente por data.
 *
 * Cada funcionário tem um histórico de períodos de escala (data_inicio..data_fim,
 * data_fim nula = em vigor). Faltas, folgas e dias de trabalho de um dia devem ser
 * lidos pela escala que estava valendo NAQUELE dia, e o ciclo (12x36, 6x1...) é
 * contado a partir do início daquele período.
 */

export interface PeriodoEscala<E = unknown> {
  id?: string;
  funcionario_id: string;
  escala_id: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string | null;
  motivo?: string | null;
  escala?: E | null;
}

/** Período que cobre a data, ou null quando o dia não tem escala registrada. */
export function periodoNaData<E>(historico: PeriodoEscala<E>[], dataISO: string): PeriodoEscala<E> | null {
  return (
    historico.find((p) => dataISO >= p.data_inicio && (p.data_fim === null || dataISO <= p.data_fim)) ?? null
  );
}

/** Ordena do mais recente para o mais antigo (linha do tempo). */
export function ordenarHistorico<E>(historico: PeriodoEscala<E>[]): PeriodoEscala<E>[] {
  return [...historico].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
}

/** Agrupa o histórico por funcionário. */
export function agruparPorFuncionario<E>(historico: PeriodoEscala<E>[]): Map<string, PeriodoEscala<E>[]> {
  const m = new Map<string, PeriodoEscala<E>[]>();
  for (const p of historico) {
    const lista = m.get(p.funcionario_id) ?? [];
    lista.push(p);
    m.set(p.funcionario_id, lista);
  }
  return m;
}

function sobrepoe(aIni: string, aFim: string | null, bIni: string, bFim: string | null): boolean {
  const fimA = aFim ?? "9999-12-31";
  const fimB = bFim ?? "9999-12-31";
  return aIni <= fimB && bIni <= fimA;
}

/**
 * Valida a troca de escala a partir de uma data (mesmas regras do banco):
 * não pode haver período começando nesta data ou depois, e a escala precisa mudar.
 */
/** Tamanho do ciclo de revezamento em dias (0 = escala semanal fixa). */
export function cicloJornadaDias(jornada: string | null | undefined): number {
  return ({ "12x36": 2, "24x48": 3, "6x1": 7 } as Record<string, number>)[jornada || ""] ?? 0;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/**
 * True quando iniciar um novo período da MESMA escala nesta data muda o dia do
 * revezamento (ex.: 12x36 de dias pares para ímpares). O ciclo conta a partir do
 * início de cada período, então basta a diferença não ser múltipla do ciclo.
 */
export function mudaRevezamento(jornada: string | null | undefined, inicioAtual: string, novaData: string): boolean {
  const ciclo = cicloJornadaDias(jornada);
  return ciclo > 0 && ((diasEntre(inicioAtual, novaData) % ciclo) + ciclo) % ciclo !== 0;
}

export function validarTrocaEscala(
  historico: PeriodoEscala[],
  novaEscalaId: number,
  dataInicio: string,
  jornadaNova?: string | null,
  motivo?: string,
): string | null {
  if (!dataInicio) return "Informe a data de início da nova escala.";
  if (!novaEscalaId) return "Selecione a nova escala.";
  if (historico.some((p) => p.data_inicio >= dataInicio)) {
    return "Já existe um período começando nesta data ou depois. Corrija ou exclua esse período no histórico.";
  }
  const atual = periodoNaData(historico, dataInicio);
  if (atual && atual.escala_id === novaEscalaId) {
    // Mesma escala só é aceita para mudar o dia do revezamento (mesmas regras do banco)
    if (!cicloJornadaDias(jornadaNova)) return "O funcionário já está nesta escala nesta data.";
    if (!mudaRevezamento(jornadaNova, atual.data_inicio, dataInicio)) {
      return "Nesta data o funcionário já trabalharia pelo revezamento atual. Escolha um dia que mude a sequência.";
    }
    if (!motivo?.trim()) return "Informe o motivo da mudança de revezamento.";
  }
  return null;
}

/** Valida um período fechado (lançamento de período antigo ou correção). */
export function validarPeriodo(
  historico: PeriodoEscala[],
  periodo: { id?: string; data_inicio: string; data_fim: string | null },
): string | null {
  if (!periodo.data_inicio) return "Informe a data de início.";
  if (periodo.data_fim && periodo.data_fim < periodo.data_inicio) return "A data de fim deve ser igual ou posterior ao início.";
  const conflito = historico.find(
    (p) => p.id !== periodo.id && sobrepoe(p.data_inicio, p.data_fim, periodo.data_inicio, periodo.data_fim),
  );
  return conflito ? "Este período se sobrepõe a outro período de escala do funcionário." : null;
}
