/**
 * Regras puras do painel de controle de assinaturas do gestor.
 * Um documento pendente há mais de PRAZO_DIAS dias é considerado "atrasado".
 */
export const PRAZO_DIAS = 3;

export interface LinhaAssinatura {
  funcionario_id: string; funcionario_nome: string; funcao: string | null;
  tipo_documento: string; referencia_id: string; titulo: string; subtitulo: string | null;
  criado_em: string; status: "pendente" | "assinado" | "recusado";
  assinado_em: string | null; motivo_recusa: string | null; hash_assinatura: string | null;
}

export type SituacaoFiltro = "todas" | "pendente" | "atrasado" | "assinado" | "recusado";

export function estaAtrasado(l: Pick<LinhaAssinatura, "status" | "criado_em">, agora = Date.now()): boolean {
  return l.status === "pendente" && agora - new Date(l.criado_em).getTime() > PRAZO_DIAS * 864e5;
}

export interface FiltrosAssinatura { busca: string; tipo: string; situacao: SituacaoFiltro }

export function filtrarAssinaturas(lista: LinhaAssinatura[], f: FiltrosAssinatura, agora = Date.now()) {
  const b = f.busca.trim().toLowerCase();
  return lista.filter((l) =>
    (!b || l.funcionario_nome.toLowerCase().includes(b) || l.titulo.toLowerCase().includes(b)) &&
    (f.tipo === "todos" || l.tipo_documento === f.tipo) &&
    (f.situacao === "todas" ||
      (f.situacao === "atrasado" ? estaAtrasado(l, agora) : l.status === f.situacao)));
}

export interface ResumoAssinaturas { total: number; pendentes: number; atrasados: number; assinados: number; recusados: number; percentual: number }

export function resumirAssinaturas(lista: LinhaAssinatura[], agora = Date.now()): ResumoAssinaturas {
  const r = { total: lista.length, pendentes: 0, atrasados: 0, assinados: 0, recusados: 0, percentual: 0 };
  for (const l of lista) {
    if (l.status === "assinado") r.assinados++;
    else if (l.status === "recusado") r.recusados++;
    else { r.pendentes++; if (estaAtrasado(l, agora)) r.atrasados++; }
  }
  r.percentual = r.total ? Math.round((r.assinados / r.total) * 100) : 0;
  return r;
}

export interface PendenciaColaborador { funcionario_id: string; nome: string; pendentes: number; atrasados: number; recusados: number }

/** Colaboradores com pendências, mais atrasados primeiro. */
export function pendenciasPorColaborador(lista: LinhaAssinatura[], agora = Date.now()): PendenciaColaborador[] {
  const m = new Map<string, PendenciaColaborador>();
  for (const l of lista) {
    if (l.status === "assinado") continue;
    const p = m.get(l.funcionario_id) ?? { funcionario_id: l.funcionario_id, nome: l.funcionario_nome, pendentes: 0, atrasados: 0, recusados: 0 };
    if (l.status === "recusado") p.recusados++; else { p.pendentes++; if (estaAtrasado(l, agora)) p.atrasados++; }
    m.set(l.funcionario_id, p);
  }
  return [...m.values()].sort((a, b) => b.atrasados - a.atrasados || b.pendentes - a.pendentes || a.nome.localeCompare(b.nome));
}
