/**
 * Regras puras do Canal de Denúncias (NR-01 – riscos psicossociais).
 * Sem acesso a dados: formato de protocolo, rótulos, matriz de risco e transições.
 */
import { z } from "zod";

export const CATEGORIAS = {
  assedio_moral: "Assédio moral",
  assedio_sexual: "Assédio sexual",
  discriminacao: "Discriminação",
  sobrecarga: "Sobrecarga / pressão excessiva",
  conflito: "Conflito interpessoal",
  outro: "Outro risco psicossocial",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export const SITUACOES = {
  recebida: "Recebida",
  em_analise: "Em análise",
  em_apuracao: "Em apuração",
  aguardando_informacoes: "Aguardando informações",
  concluida: "Concluída",
  arquivada: "Arquivada",
} as const;
export type Situacao = keyof typeof SITUACOES;

export const CONCLUSOES = { procedente: "Procedente", improcedente: "Improcedente", inconclusiva: "Inconclusiva" } as const;

/** Próximas situações permitidas a partir da atual. */
const TRANSICOES: Record<Situacao, Situacao[]> = {
  recebida: ["em_analise", "arquivada"],
  em_analise: ["em_apuracao", "aguardando_informacoes", "concluida", "arquivada"],
  em_apuracao: ["aguardando_informacoes", "concluida"],
  aguardando_informacoes: ["em_analise", "em_apuracao", "concluida", "arquivada"],
  concluida: ["arquivada", "em_apuracao"],
  arquivada: [],
};
export function proximasSituacoes(s: Situacao): Situacao[] {
  return TRANSICOES[s] ?? [];
}

export const PROTOCOLO_RE = /^[A-Z0-9]{2}-[A-Z0-9]{3}-[A-Z0-9]{3}$/;
/** Normaliza o protocolo digitado (maiúsculas, hífens no lugar certo). */
export function normalizarProtocolo(entrada: string): string {
  const s = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (s.length <= 2) return s;
  if (s.length <= 5) return `${s.slice(0, 2)}-${s.slice(2)}`;
  return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
}

/** Matriz de risco do GRO (NR-01): probabilidade x severidade, 1 a 5 cada. */
export function nivelRisco(prob?: number | null, sev?: number | null): { pontos: number; nivel: "baixo" | "moderado" | "alto" | "critico" | "nao_avaliado" } {
  if (!prob || !sev) return { pontos: 0, nivel: "nao_avaliado" };
  const pontos = prob * sev;
  const nivel = pontos >= 15 ? "critico" : pontos >= 10 ? "alto" : pontos >= 5 ? "moderado" : "baixo";
  return { pontos, nivel };
}

/** Prazo de resposta vencido (data AAAA-MM-DD comparada com o dia de hoje em Brasília). */
export function prazoVencido(prazo: string, situacao: Situacao, hojeBrasilia: string): boolean {
  if (situacao === "concluida" || situacao === "arquivada") return false;
  return prazo < hojeBrasilia;
}

export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
export const ANEXO_MAX_QTD = 5;
export const ANEXO_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav", "audio/x-m4a", "audio/aac"];

export const formularioDenunciaSchema = z.object({
  anonima: z.boolean(),
  nome: z.string().trim().max(120).optional(),
  contato: z.string().trim().max(160).optional(),
  categoria: z.enum(Object.keys(CATEGORIAS) as [Categoria, ...Categoria[]], { required_error: "Escolha o tipo de situação" }),
  quando: z.string().trim().max(120).optional(),
  local: z.string().trim().max(200).optional(),
  envolvidos: z.string().trim().max(1000).optional(),
  testemunhas: z.string().trim().max(1000).optional(),
  relato: z.string().trim().min(20, "Descreva o ocorrido com pelo menos 20 caracteres").max(8000, "Relato muito longo"),
  ainda_ocorre: z.boolean().optional(),
}).refine((v) => v.anonima || (v.nome && v.nome.length > 1), { message: "Informe seu nome ou escolha o envio anônimo", path: ["nome"] });

/** Relatório agregado (sem dados identificáveis) por mês e categoria. */
export function agregarPorMes(lista: { created_at: string; categoria: string }[]): { mes: string; total: number; porCategoria: Record<string, number> }[] {
  const mapa = new Map<string, { total: number; porCategoria: Record<string, number> }>();
  for (const d of lista) {
    const mes = new Date(d.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
    const m = mapa.get(mes) ?? { total: 0, porCategoria: {} };
    m.total++;
    m.porCategoria[d.categoria] = (m.porCategoria[d.categoria] ?? 0) + 1;
    mapa.set(mes, m);
  }
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, v]) => ({ mes, ...v }));
}
