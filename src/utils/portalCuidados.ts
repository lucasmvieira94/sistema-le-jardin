/**
 * Regras puras do Portal de Cuidados dos Residentes.
 * O servidor (RPCs `portal_cuidados_*`) é quem garante o acesso e a lista
 * branca de campos; estas funções espelham a regra na tela e servem de
 * segunda barreira caso algum campo proibido apareça na resposta.
 */

export const MODULO_PORTAL_CUIDADOS = "portal_cuidados";

/** Atalhos de rotina do portal e o módulo que libera cada um. */
export const ATALHOS_CUIDADOS = [
  { id: "prontuario", rota: "/prontuario", nome: "Prontuário do dia" },
  { id: "medicamentos", rota: "/administracao-medicamentos", nome: "Medicamentos" },
  { id: "fraldas", rota: "/controle-fraldas-publico", nome: "Fraldas" },
  { id: "temperatura", rota: "/temperatura-medicamentos", nome: "Temperatura" },
  { id: "vacinas", rota: "/controle-vacinas-publico", nome: "Vacinas" },
  { id: "intercorrencias", rota: "/intercorrencias", nome: "Intercorrências" },
  { id: "meus_prontuarios", rota: "/meus-prontuarios", nome: "Meus prontuários" },
] as const;

export function podeAcessarPortalCuidados(modulos: string[] | null | undefined): boolean {
  return !!modulos?.includes(MODULO_PORTAL_CUIDADOS);
}

/** Atalhos visíveis: só com o portal liberado e o módulo do atalho também. */
export function atalhosLiberados(modulos: string[] | null | undefined) {
  if (!podeAcessarPortalCuidados(modulos)) return [];
  return ATALHOS_CUIDADOS.filter((a) => modulos!.includes(a.id));
}

/** Campos que nunca podem chegar à equipe de cuidados. */
export const CAMPOS_PROIBIDOS = [
  "cpf", "responsavel_cpf", "responsavel_email", "responsavel_endereco",
  "preenchido_por_cpf", "contratos", "distratos", "mensalidades", "faturas", "valor", "token",
];

/** Remove recursivamente qualquer campo proibido de uma resposta. */
export function semCamposProibidos<T>(dado: T): T {
  if (Array.isArray(dado)) return dado.map((d) => semCamposProibidos(d)) as T;
  if (dado && typeof dado === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dado as Record<string, unknown>)) {
      if (CAMPOS_PROIBIDOS.includes(k)) continue;
      out[k] = semCamposProibidos(v);
    }
    return out as T;
  }
  return dado;
}

/** Idade em anos completos a partir de "AAAA-MM-DD" (fuso de Brasília). */
export function idade(dataNascimento: string | null | undefined, hoje = new Date()): number | null {
  if (!dataNascimento) return null;
  const n = new Date(`${dataNascimento}T12:00:00`);
  let a = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) a--;
  return a;
}

/** Filtro da lista por nome ou quarto, sem diferenciar acentos/maiúsculas. */
export function filtrarResidentes<T extends { nome_completo: string; quarto: string | null }>(lista: T[], busca: string): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(busca.trim());
  if (!q) return lista;
  return lista.filter((r) => norm(r.nome_completo).includes(q) || norm(r.quarto ?? "").includes(q));
}
