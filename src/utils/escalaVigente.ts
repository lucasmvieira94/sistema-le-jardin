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
export function validarTrocaEscala(
  historico: PeriodoEscala[],
  novaEscalaId: number,
  dataInicio: string,
): string | null {
  if (!dataInicio) return "Informe a data de início da nova escala.";
  if (!novaEscalaId) return "Selecione a nova escala.";
  if (historico.some((p) => p.data_inicio >= dataInicio)) {
    return "Já existe um período começando nesta data ou depois. Corrija ou exclua esse período no histórico.";
  }
  const atual = periodoNaData(historico, dataInicio);
  if (atual && atual.escala_id === novaEscalaId) return "O funcionário já está nesta escala nesta data.";
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
