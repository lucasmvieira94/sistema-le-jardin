/**
 * Regras do prontuário em ciclo de 24 horas.
 *
 * O prontuário de cada residente fica aberto das 00h00 às 23h59 (UTC-3) e recebe
 * lançamentos imutáveis das cuidadoras dos dois turnos. À meia-noite o dia anterior
 * é encerrado automaticamente e passa a ser somente leitura.
 */

export const TIMEZONE_BR = "America/Sao_Paulo";

/** Tipos de registro que compõem o conteúdo clínico do prontuário do dia. */
export const TIPOS_LANCAMENTO = [
  "prontuario_completo", // legado: formulário único do modelo antigo
  "lancamento",
  "retificacao",
] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export interface LancamentoProntuario {
  id: string;
  ciclo_id: string | null;
  residente_id: string;
  funcionario_id: string;
  funcionario_nome?: string | null;
  tipo_registro: string;
  titulo: string;
  descricao: string;
  created_at: string;
  horario_registro?: string | null;
  retifica_registro_id?: string | null;
  justificativa_retificacao?: string | null;
}

export interface LancamentoComRetificacoes extends LancamentoProntuario {
  conteudo: Record<string, unknown>;
  retificacoes: LancamentoComRetificacoes[];
}

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília. */
export function hojeCicloISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * O ciclo só aceita novos lançamentos quando é o dia corrente e ainda não foi encerrado.
 */
export function cicloAceitaLancamento(
  dataCiclo: string | null | undefined,
  status: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!dataCiclo) return true; // ciclo ainda não criado: será criado hoje
  if (status === "encerrado") return false;
  return dataCiclo === hojeCicloISO(agora);
}

/** Turno da cuidadora: diurno 08h-19h59, noturno 20h-07h59. */
export function turnoDoHorario(iso: string): "diurno" | "noturno" {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE_BR,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(iso)),
  );
  return hora >= 8 && hora < 20 ? "diurno" : "noturno";
}

export function horaFormatada(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE_BR,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function parseConteudo(descricao: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(descricao);
    return parsed && typeof parsed === "object" ? parsed : { texto: descricao };
  } catch {
    return { texto: descricao };
  }
}

function valorFoiPreenchido(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.some((item) => valorFoiPreenchido(item));
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "boolean") return true;
  if (typeof valor === "object") return Object.values(valor).some((item) => valorFoiPreenchido(item));
  return false;
}

/**
 * Retorna as perguntas que já receberam uma resposta original no ciclo.
 * Retificações não abrem a pergunta novamente: a correção permanece vinculada
 * ao registro original na linha do tempo.
 */
export function obterChavesPreenchidas(registros: LancamentoProntuario[]): Set<string> {
  const chaves = new Set<string>();

  registros
    .filter((registro) => !registro.retifica_registro_id && registro.tipo_registro !== "retificacao")
    .forEach((registro) => {
      Object.entries(parseConteudo(registro.descricao)).forEach(([chave, valor]) => {
        if (valorFoiPreenchido(valor)) chaves.add(chave);
      });
    });

  return chaves;
}

/**
 * Monta a linha do tempo do ciclo: lançamentos em ordem cronológica, com as
 * retificações aninhadas sob o registro original.
 */
export function montarLinhaTempo(
  registros: LancamentoProntuario[],
): LancamentoComRetificacoes[] {
  const ordenados = [...registros]
    .filter((r) => (TIPOS_LANCAMENTO as readonly string[]).includes(r.tipo_registro))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const mapa = new Map<string, LancamentoComRetificacoes>();
  const raiz: LancamentoComRetificacoes[] = [];

  for (const registro of ordenados) {
    const item: LancamentoComRetificacoes = {
      ...registro,
      conteudo: parseConteudo(registro.descricao),
      retificacoes: [],
    };
    mapa.set(item.id, item);
  }

  for (const item of mapa.values()) {
    const pai = item.retifica_registro_id ? mapa.get(item.retifica_registro_id) : undefined;
    if (pai) {
      pai.retificacoes.push(item);
    } else {
      raiz.push(item);
    }
  }

  return raiz.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Consolida todos os lançamentos do ciclo em um único objeto (o último valor
 * informado para cada campo prevalece). Usado pela IA e pelos relatórios.
 */
export function consolidarLancamentos(
  registros: LancamentoProntuario[],
): Record<string, unknown> {
  const consolidado: Record<string, unknown> = {};
  const ordenados = [...registros].sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const registro of ordenados) {
    const conteudo = parseConteudo(registro.descricao);
    for (const [chave, valor] of Object.entries(conteudo)) {
      if (valor === undefined || valor === null || valor === "") continue;
      consolidado[chave] = valor;
    }
  }

  return consolidado;
}

/** Linha retornada pela RPC `monitorar_prontuarios_dia`. */
export interface MonitoramentoResidente {
  residente_id: string;
  residente_nome: string;
  quarto: string | null;
  ciclo_id: string | null;
  status: string;
  lancamentos: number;
  retificacoes: number;
  diurno: number;
  noturno: number;
  ultimo_lancamento: string | null;
  ultima_autora: string | null;
}

export type PendenciaDia = "sem_lancamento" | "diurno_pendente" | "noturno_pendente";

/** Data (YYYY-MM-DD) do dia anterior no fuso de Brasília. */
export function ontemCicloISO(agora: Date = new Date()): string {
  return hojeCicloISO(new Date(agora.getTime() - 24 * 60 * 60 * 1000));
}

/**
 * Turno noturno do dia anterior (20h de ontem às 08h de hoje) sem registro.
 * Só é cobrado depois das 08h de hoje, quando o turno já terminou.
 */
export function noturnoAnteriorPendente(
  ontem: MonitoramentoResidente | undefined,
  agora: Date = new Date(),
): boolean {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE_BR, hour: "2-digit", hour12: false }).format(agora),
  );
  if (hora < 8) return false;
  return !ontem || ontem.noturno === 0;
}

/** O dia corrente nunca pode ser encerrado manualmente. */
export function cicloPodeSerEncerrado(dataCiclo: string, agora: Date = new Date()): boolean {
  return dataCiclo < hojeCicloISO(agora);
}

/**
 * Pendências do dia corrente para um residente:
 * - sem nenhum lançamento;
 * - turno diurno (08h-20h) encerrado sem lançamento diurno (só após 20h).
 */
export function pendenciasDoDia(m: MonitoramentoResidente, agora: Date = new Date()): PendenciaDia[] {
  const pend: PendenciaDia[] = [];
  if (m.lancamentos === 0) pend.push("sem_lancamento");
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE_BR, hour: "2-digit", hour12: false }).format(agora),
  );
  if (m.lancamentos > 0 && hora >= 20 && m.diurno === 0) pend.push("diurno_pendente");
  return pend;
}
