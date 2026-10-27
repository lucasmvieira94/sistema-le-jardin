/**
 * Regras puras do Mapa de Medicamentos do dia (Portal de Cuidados).
 * Monta a lista de doses previstas para hoje, por horário, e classifica cada uma.
 */

export interface PrescricaoMapa {
  id: string;
  residente_id: string;
  medicamento_id: string;
  dosagem: string;
  frequencia_tipo: string;
  frequencia_valor?: number | null;
  horarios?: string[] | null;
  dia_semana?: number | null;
  intervalo_dias?: number | null;
  data_inicio: string;
  data_fim?: string | null;
  via_administracao?: string | null;
  observacoes?: string | null;
  medicamento?: { nome: string } | null;
  residente?: { nome_completo: string } | null;
}

export interface AdministracaoMapa {
  medicamento_id: string;
  residente_id: string;
  horario_administracao?: string | null;
  tipo?: string | null; // "rotina" | "emergencia"
}

export type StatusDose = "administrado" | "atrasado" | "agora" | "proximo";

export interface DoseDia {
  chave: string;
  prescricao: PrescricaoMapa;
  horario: string; // HH:mm
  status: StatusDose;
  /** Remédio continua no mapa mesmo com o estoque do residente zerado. */
  semEstoque: boolean;
}

/** Chave residente|medicamento usada para o saldo do estoque. */
export const chaveSaldo = (residenteId: string, medicamentoId: string) => `${residenteId}|${medicamentoId}`;

/** Tolerância (min) para considerar a dose "agora" antes/depois do horário. */
export const JANELA_MINUTOS = 60;

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** Horários previstos da prescrição (lista vazia = horários não cadastrados). */
export function horariosDaPrescricao(p: PrescricaoMapa): string[] {
  if (p.horarios?.length) return [...p.horarios].map((h) => h.slice(0, 5)).sort();
  if (p.frequencia_tipo === "a_cada_x_horas" && p.frequencia_valor && p.frequencia_valor > 0) {
    const hrs: string[] = [];
    for (let h = 0; h < 24; h += p.frequencia_valor) hrs.push(`${String(h).padStart(2, "0")}:00`);
    return hrs;
  }
  return [];
}

/** A prescrição vale para a data (yyyy-MM-dd)? Considera vigência, dia da semana e intervalo. */
export function prescricaoValeNoDia(p: PrescricaoMapa, dia: string): boolean {
  if (p.data_inicio && p.data_inicio.slice(0, 10) > dia) return false;
  if (p.data_fim && p.data_fim.slice(0, 10) < dia) return false;
  if (p.frequencia_tipo === "dia_especifico") {
    return new Date(`${dia}T12:00:00Z`).getUTCDay() === (p.dia_semana ?? 0);
  }
  if (p.frequencia_tipo === "intervalo_dias" && p.intervalo_dias && p.intervalo_dias > 1) {
    return diasEntre(p.data_inicio.slice(0, 10), dia) % p.intervalo_dias === 0;
  }
  return true;
}

export function statusDose(horario: string, agoraHHmm: string, administrado: boolean): StatusDose {
  if (administrado) return "administrado";
  const diff = minutos(horario) - minutos(agoraHHmm);
  if (diff < -JANELA_MINUTOS) return "atrasado";
  if (diff <= JANELA_MINUTOS) return "agora";
  return "proximo";
}

/** Monta as doses do dia ordenadas por horário e nome do residente. */
export function montarMapaDia(
  prescricoes: PrescricaoMapa[],
  administracoes: AdministracaoMapa[],
  dia: string,
  agoraHHmm: string,
  saldo?: Map<string, number>,
): { doses: DoseDia[]; semHorario: PrescricaoMapa[] } {
  const feitos = new Set(
    administracoes.filter((a) => a.tipo !== "emergencia").map((a) => `${a.residente_id}|${a.medicamento_id}|${(a.horario_administracao ?? "").slice(0, 5)}`),
  );
  const doses: DoseDia[] = [];
  const semHorario: PrescricaoMapa[] = [];
  for (const p of prescricoes) {
    if (!prescricaoValeNoDia(p, dia)) continue;
    const hrs = horariosDaPrescricao(p);
    if (!hrs.length) { semHorario.push(p); continue; }
    for (const h of hrs) {
      const ok = feitos.has(`${p.residente_id}|${p.medicamento_id}|${h}`);
      const semEstoque = saldo ? (saldo.get(chaveSaldo(p.residente_id, p.medicamento_id)) ?? 0) <= 0 : false;
      doses.push({ chave: `${p.id}|${h}`, prescricao: p, horario: h, status: statusDose(h, agoraHHmm, ok), semEstoque });
    }
  }
  doses.sort((a, b) =>
    a.horario.localeCompare(b.horario) ||
    (a.prescricao.residente?.nome_completo ?? "").localeCompare(b.prescricao.residente?.nome_completo ?? ""));
  return { doses, semHorario };
}

/** Agrupa as doses por horário, mantendo a ordem. */
export function agruparPorHorario(doses: DoseDia[]): [string, DoseDia[]][] {
  const m = new Map<string, DoseDia[]>();
  for (const d of doses) m.set(d.horario, [...(m.get(d.horario) ?? []), d]);
  return [...m.entries()];
}

export function resumoDoses(doses: DoseDia[]) {
  const r = { total: doses.length, administrado: 0, atrasado: 0, agora: 0, proximo: 0 };
  for (const d of doses) r[d.status]++;
  return r;
}

/** Soma o saldo do estoque do residente por residente|medicamento. */
export function saldoPorResidente(estoques: { residente_id: string | null; medicamento_id: string; quantidade_atual: number | string; tipo_estoque?: string | null }[]) {
  const m = new Map<string, number>();
  for (const e of estoques) {
    if (!e.residente_id || (e.tipo_estoque && e.tipo_estoque !== "residente")) continue;
    const k = chaveSaldo(e.residente_id, e.medicamento_id);
    m.set(k, (m.get(k) ?? 0) + Number(e.quantidade_atual || 0));
  }
  return m;
}

export type SituacaoEmergencia = "vencido" | "zerado" | "vence_breve" | "baixo" | "ok";

/** Situação de um lote do estoque de emergência (mesma regra do servidor). */
export function situacaoLote(qtd: number, minimo: number, validade: string | null, hoje: string): SituacaoEmergencia {
  if (validade && validade < hoje) return "vencido";
  if (qtd <= 0) return "zerado";
  if (validade && diasEntre(hoje, validade) <= 30) return "vence_breve";
  if (qtd <= minimo) return "baixo";
  return "ok";
}

/** FEFO: lote utilizável que vence primeiro (vencidos e zerados ficam de fora). */
export function loteParaUso<T extends { quantidade: number; validade: string | null }>(lotes: T[], hoje: string): T | null {
  const ok = lotes.filter((l) => l.quantidade >= 1 && (!l.validade || l.validade >= hoje));
  ok.sort((a, b) => (a.validade ?? "9999-12-31").localeCompare(b.validade ?? "9999-12-31"));
  return ok[0] ?? null;
}
