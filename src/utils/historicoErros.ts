/** Regras puras da tela de histórico de erros (filtros e resumo por módulo). */
export interface ErroSistema {
  id: string; origem: string; erro: string; diagnostico: string | null; sugestao: string | null;
  gravidade: string | null; resolvido: boolean; created_at: string;
  resolvido_em?: string | null; observacao_resolucao?: string | null; contexto?: unknown;
}

export interface FiltrosErros {
  modulo: string; gravidade: string; status: "todos" | "abertos" | "resolvidos";
  /** Datas no formato AAAA-MM-DD, interpretadas no horário de Brasília. */
  de?: string; ate?: string;
}

/** Limites do período em ISO (UTC), com o dia inteiro em Brasília (UTC-3). */
export function limitesPeriodo(de?: string, ate?: string) {
  return {
    inicio: de ? new Date(`${de}T00:00:00-03:00`).toISOString() : undefined,
    fim: ate ? new Date(`${ate}T23:59:59.999-03:00`).toISOString() : undefined,
  };
}

export function filtrarErros(lista: ErroSistema[], f: FiltrosErros): ErroSistema[] {
  const { inicio, fim } = limitesPeriodo(f.de, f.ate);
  return lista.filter((e) =>
    (f.modulo === "todos" || e.origem === f.modulo) &&
    (f.gravidade === "todas" || (e.gravidade ?? "media") === f.gravidade) &&
    (f.status === "todos" || (f.status === "resolvidos" ? e.resolvido : !e.resolvido)) &&
    (!inicio || e.created_at >= inicio) && (!fim || e.created_at <= fim));
}

export interface ResumoModulo { modulo: string; total: number; abertos: number; altas: number }

/** Totais por módulo, do mais problemático para o menos. */
export function resumoPorModulo(lista: ErroSistema[]): ResumoModulo[] {
  const m = new Map<string, ResumoModulo>();
  for (const e of lista) {
    const r = m.get(e.origem) ?? { modulo: e.origem, total: 0, abertos: 0, altas: 0 };
    r.total++; if (!e.resolvido) r.abertos++; if (e.gravidade === "alta") r.altas++;
    m.set(e.origem, r);
  }
  return [...m.values()].sort((a, b) => b.abertos - a.abertos || b.total - a.total);
}
