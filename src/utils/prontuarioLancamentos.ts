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
