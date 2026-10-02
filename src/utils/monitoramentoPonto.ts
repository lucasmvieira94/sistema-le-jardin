/**
 * Monitoramento da apropriação de horas (regras puras, sem acesso ao banco).
 *
 * Aponta ausências de informação nas rotinas de RH:
 * - falta não justificada (dia de escala sem entrada e sem afastamento);
 * - saída não registrada (2h após o fim previsto do turno);
 * - intervalo não registrado, aberto ou abaixo do mínimo (escalas sem pré-assinalação);
 * - atraso acima da tolerância sem justificativa enviada;
 * - registro de ponto em dia de folga (fora da escala);
 * - afastamento médico sem anexo (atestado);
 * - folha de ponto do mês anterior não publicada ou não confirmada.
 *
 * Todos os horários são interpretados no fuso de Brasília (UTC-3). Para evitar
 * deslocamentos de fuso, trabalhamos com "horário de parede": uma data/hora de
 * Brasília é convertida em milissegundos como se fosse UTC.
 */

import { periodoNaData, type PeriodoEscala } from "./escalaVigente";

export const TIMEZONE_BR = "America/Sao_Paulo";
export const TOLERANCIA_ATRASO_MIN = 15;
export const TOLERANCIA_SAIDA_MIN = 120;
/** A cobrança da folha do mês anterior começa neste dia do mês corrente. */
export const DIA_COBRANCA_FOLHA = 5;

export type TipoPendenciaPonto =
  | "falta_nao_justificada"
  | "saida_nao_registrada"
  | "intervalo_irregular"
  | "atraso_sem_justificativa"
  | "fora_da_escala"
  | "afastamento_sem_anexo"
  | "folha_nao_publicada"
  | "folha_nao_confirmada";

export const ROTULOS_PENDENCIA_PONTO: Record<TipoPendenciaPonto, string> = {
  falta_nao_justificada: "Falta não justificada",
  saida_nao_registrada: "Saída não registrada",
  intervalo_irregular: "Intervalo irregular",
  atraso_sem_justificativa: "Atraso sem justificativa",
  fora_da_escala: "Registro fora da escala",
  afastamento_sem_anexo: "Afastamento sem atestado",
  folha_nao_publicada: "Folha do mês não publicada",
  folha_nao_confirmada: "Folha não confirmada",
};

export interface EscalaMonit {
  entrada: string | null;
  saida: string | null;
  jornada_trabalho: string | null;
  intervalo_pre_assinalado: boolean | null;
  intervalo_minutos: number | null;
}

export interface FuncionarioMonit {
  id: string;
  nome_completo: string;
  data_inicio_vigencia: string | null;
  escala: EscalaMonit | null;
}

export interface RegistroMonit {
  funcionario_id: string;
  data: string;
  entrada: string | null;
  saida: string | null;
  intervalo_inicio?: string | null;
  intervalo_fim?: string | null;
  intervalos_pausas?: unknown;
}

export interface AfastamentoMonit {
  id: string;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string | null;
  tipo_descricao?: string | null;
  possui_anexo?: boolean;
}

export interface FolhaMonit {
  funcionario_id: string;
  mes: number;
  ano: number;
  confirmado: boolean | null;
}

export interface EntradaMonitoramento {
  funcionarios: FuncionarioMonit[];
  registros: RegistroMonit[];
  afastamentos: AfastamentoMonit[];
  /** Chaves `${funcionario_id}|${data}` com justificativa de atraso enviada. */
  justificativas: Set<string>;
  folhas: FolhaMonit[];
  dias: number;
  agora?: Date;
  /** Histórico de escalas por funcionário (escala resolvida por data). */
  historico?: Map<string, PeriodoEscala<EscalaMonit>[]>;
}

export interface PendenciaPonto {
  id: string;
  tipo: TipoPendenciaPonto;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  descricao: string;
}

// ---------- utilitários de data ----------

/** Horário de parede de Brasília do instante informado, em ms "como UTC". */
export function agoraParedeBR(agora: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE_BR,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(agora).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
}

function paredeDe(dataISO: string, hora = "00:00"): number {
  const [y, m, d] = dataISO.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h || 0, mi || 0);
}

function isoDeParede(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DIA_MS = 86_400_000;

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Diferença real - previsto em minutos. */
function diff(previsto: string, real: string): number {
  return minutos(real) - minutos(previsto);
}

/** True quando a jornada indica folga naquele dia. */
export function estaEmFolga(jornada: string | null, inicioVigencia: string, dataISO: string): boolean {
  const dias = Math.round((paredeDe(dataISO) - paredeDe(inicioVigencia)) / DIA_MS);
  const dow = new Date(paredeDe(dataISO)).getUTCDay();
  switch (jornada || "5x2") {
    case "12x36": return ((dias % 2) + 2) % 2 === 1;
    case "24x48": return ((dias % 3) + 3) % 3 !== 0;
    case "6x1": return ((dias % 7) + 7) % 7 === 6;
    case "5x2":
    case "40h_8h_segsex": return dow === 0 || dow === 6;
    case "44h_8h_segsex_4h_sab":
    case "36h_6h_seg_sab": return dow === 0;
    default: return false;
  }
}

/** Afastamentos com esta descrição exigem comprovante anexado. */
export function exigeComprovante(descricao: string | null | undefined): boolean {
  return /atestado|m[eé]dic|doen|licen[cç]a|acidente/i.test(descricao || "");
}

// ---------- intervalo ----------

function avaliarIntervalo(reg: RegistroMonit, escala: EscalaMonit): string | null {
  if (escala.intervalo_pre_assinalado || !escala.entrada) return null;
  const pausas = Array.isArray(reg.intervalos_pausas)
    ? (reg.intervalos_pausas as { inicio?: string; fim?: string }[])
    : [];
  const aberta = pausas.some((p) => p?.inicio && !p?.fim) || (!!reg.intervalo_inicio && !reg.intervalo_fim);
  let total = 0;
  for (const p of pausas) {
    if (p?.inicio && p?.fim) total += (diff(p.inicio, p.fim) + 1440) % 1440;
  }
  if (pausas.length === 0 && reg.intervalo_inicio && reg.intervalo_fim) {
    total += (diff(reg.intervalo_inicio, reg.intervalo_fim) + 1440) % 1440;
  }
  const jornada = (diff(escala.entrada, escala.saida || escala.entrada) + 1440) % 1440;
  const minimo = jornada > 360 ? Number(escala.intervalo_minutos) || 60 : jornada > 240 ? 15 : 0;
  if (aberta) return "Iniciou o intervalo e não registrou o retorno";
  if (minimo > 0 && total === 0) return `Não registrou intervalo (mínimo ${minimo} min)`;
  if (minimo > 0 && total < minimo) return `Intervalo de ${total} min, abaixo do mínimo de ${minimo} min`;
  return null;
}

// ---------- análise principal ----------

export function analisarPonto(e: EntradaMonitoramento): PendenciaPonto[] {
  const agora = e.agora ?? new Date();
  const agoraMs = agoraParedeBR(agora);
  const hoje = isoDeParede(agoraMs);
  const out: PendenciaPonto[] = [];
  const regPorChave = new Map(e.registros.map((r) => [`${r.funcionario_id}|${r.data}`, r]));

  const push = (tipo: TipoPendenciaPonto, f: FuncionarioMonit, data: string, descricao: string) =>
    out.push({ id: `${tipo}-${f.id}-${data}`, tipo, funcionario_id: f.id, funcionario_nome: f.nome_completo, data, descricao });

  for (const f of e.funcionarios) {
    const historicoFunc = e.historico?.get(f.id) ?? [];
    const afast = e.afastamentos.filter((a) => a.funcionario_id === f.id);
    const afastadoEm = (d: string) => afast.some((a) => d >= a.data_inicio && d <= (a.data_fim || a.data_inicio));

    for (let i = 0; i <= e.dias; i++) {
      const dia = isoDeParede(agoraMs - i * DIA_MS);
      // Escala vigente NESTE dia: histórico quando existe; senão o cadastro atual
      let esc: EscalaMonit | null;
      let inicio: string | null;
      if (historicoFunc.length > 0) {
        const periodo = periodoNaData(historicoFunc, dia);
        esc = periodo?.escala ?? null;
        inicio = periodo?.data_inicio ?? null;
      } else {
        esc = f.escala;
        inicio = f.data_inicio_vigencia;
        if (inicio && dia < inicio) continue;
      }
      const reg = regPorChave.get(`${f.id}|${dia}`);
      const temEscala = !!(esc?.entrada && inicio);
      const folga = temEscala ? estaEmFolga(esc!.jornada_trabalho, inicio!, dia) : false;
      const afastado = afastadoEm(dia);

      // Registro em dia de folga
      if (reg?.entrada && temEscala && folga && !afastado) {
        push("fora_da_escala", f, dia, "Registrou ponto em dia de folga da escala");
      }
      if (!temEscala || folga || afastado) continue;

      const entradaPrevista = paredeDe(dia, esc!.entrada!);
      // Dia corrente: só cobra falta depois da entrada prevista + tolerância
      if (!reg?.entrada) {
        if (dia < hoje || agoraMs > entradaPrevista + TOLERANCIA_SAIDA_MIN * 60_000) {
          push("falta_nao_justificada", f, dia, "Tinha escala e não registrou entrada nem afastamento");
        }
        continue;
      }

      const atraso = diff(esc!.entrada!, reg.entrada);
      if (atraso > TOLERANCIA_ATRASO_MIN && !e.justificativas.has(`${f.id}|${dia}`)) {
        push("atraso_sem_justificativa", f, dia, `Chegou ${atraso} min após ${esc!.entrada!.slice(0, 5)} e não justificou`);
      }

      // Fim do turno (vira o dia no noturno) + tolerância
      const saidaPrev = esc!.saida || esc!.entrada!;
      let fim = paredeDe(dia, saidaPrev);
      if (minutos(saidaPrev) <= minutos(esc!.entrada!)) fim += DIA_MS;
      const turnoEncerrado = agoraMs > fim + TOLERANCIA_SAIDA_MIN * 60_000;

      if (!reg.saida && turnoEncerrado) {
        push("saida_nao_registrada", f, dia, "Registrou entrada e não registrou saída");
      }
      if (turnoEncerrado) {
        const msg = avaliarIntervalo(reg, esc!);
        if (msg) push("intervalo_irregular", f, dia, msg);
      }
    }

    for (const a of afast) {
      if (exigeComprovante(a.tipo_descricao) && !a.possui_anexo) {
        out.push({
          id: `afastamento_sem_anexo-${a.id}`, tipo: "afastamento_sem_anexo",
          funcionario_id: f.id, funcionario_nome: f.nome_completo, data: a.data_inicio,
          descricao: `${a.tipo_descricao} sem atestado anexado`,
        });
      }
    }

    // Folha do mês anterior
    const [ay, am, ad] = hoje.split("-").map(Number);
    if (ad >= DIA_COBRANCA_FOLHA) {
      const mes = am === 1 ? 12 : am - 1;
      const ano = am === 1 ? ay - 1 : ay;
      const ref = `${ano}-${String(mes).padStart(2, "0")}-01`;
      if (!f.data_inicio_vigencia || f.data_inicio_vigencia <= `${ref.slice(0, 8)}31`) {
        const folha = e.folhas.find((x) => x.funcionario_id === f.id && x.mes === mes && x.ano === ano);
        const rot = `${String(mes).padStart(2, "0")}/${ano}`;
        if (!folha) push("folha_nao_publicada", f, ref, `Folha de ${rot} ainda não publicada ao funcionário`);
        else if (folha.confirmado !== true) push("folha_nao_confirmada", f, ref, `Folha de ${rot} sem confirmação do funcionário`);
      }
    }
  }

  return out.sort((a, b) => b.data.localeCompare(a.data) || a.funcionario_nome.localeCompare(b.funcionario_nome));
}

/** Contagem por tipo, para os indicadores do quadro. */
export function contarPorTipo(p: PendenciaPonto[]): Record<TipoPendenciaPonto, number> {
  const base = Object.fromEntries(Object.keys(ROTULOS_PENDENCIA_PONTO).map((k) => [k, 0])) as Record<TipoPendenciaPonto, number>;
  for (const x of p) base[x.tipo]++;
  return base;
}
