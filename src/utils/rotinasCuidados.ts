import { z } from "zod";

/** Rotina de cuidado do residente (procedimento, aferição ou orientação). Remédios ficam no Mapa de Medicamentos. */
export type TipoRotina = "procedimento" | "afericao" | "orientacao";
export type FrequenciaRotina = "horarios" | "momento" | "plantao";

export interface RotinaCuidado {
  id: string; residente_id: string; residente_nome: string; titulo: string; tipo: TipoRotina;
  instrucoes: string | null; frequencia: FrequenciaRotina; horarios: string[]; momento: string | null;
  tipo_afericao: string | null; dias_semana: number[]; inicio: string; fim: string | null;
  encerrada_em: string | null; motivo_encerramento: string | null; criado_por_nome: string | null;
}
export interface ExecucaoRotina {
  id: string; rotina_id: string; data: string; chave: string; feito_em: string; feito_por_nome: string | null;
  valor: string | null; observacao: string | null; titulo: string; tipo_afericao: string | null; residente_id: string;
}
export type StatusOcorrencia = "feito" | "atrasado" | "agora" | "proximo";
export interface Ocorrencia { rotina: RotinaCuidado; data: string; chave: string; rotulo: string; minutos: number; status: StatusOcorrencia; execucao?: ExecucaoRotina }

export const TIPOS: Record<TipoRotina, string> = { procedimento: "Procedimento", afericao: "Aferição", orientacao: "Orientação" };
export const MOMENTOS: Record<string, string> = { banho: "No banho", refeicao: "Nas refeições", troca: "Nas trocas", dormir: "Ao dormir", acordar: "Ao acordar" };
export const AFERICOES: Record<string, string> = { pressao: "Pressão arterial", glicemia: "Glicemia", temperatura: "Temperatura", saturacao: "Saturação", frequencia_cardiaca: "Frequência cardíaca", peso: "Peso", outro: "Outro" };
export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Palavras que indicam remédio: esses itens devem ir ao Mapa de Medicamentos, não a uma rotina. */
const PALAVRAS_REMEDIO = /\b(comprimido|c[aá]psula|dipirona|paracetamol|insulina|gotas de|xarope|mg\b|medica[cç][aã]o|rem[eé]dio)/i;
export const pareceMedicamento = (t: string) => PALAVRAS_REMEDIO.test(t);

const minutos = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const MARGEM = 60;

/** A rotina vale neste dia? (vigência, encerramento e dias da semana). */
export function vigenteEm(r: Pick<RotinaCuidado, "inicio" | "fim" | "encerrada_em" | "dias_semana">, dia: string) {
  if (r.encerrada_em || dia < r.inicio || (r.fim && dia > r.fim)) return false;
  if (!r.dias_semana?.length) return true;
  return r.dias_semana.includes(new Date(`${dia}T12:00:00`).getDay());
}

/** Gera as ocorrências que precisam de registro no dia (orientações não geram). */
export function ocorrenciasDoDia(rotinas: RotinaCuidado[], execucoes: ExecucaoRotina[], dia: string, agoraMin: number): Ocorrencia[] {
  const feito = new Map(execucoes.map((e) => [`${e.rotina_id}|${e.data}|${e.chave}`, e]));
  const anterior = diaAnterior(dia);
  const out: Ocorrencia[] = [];
  for (const r of rotinas) {
    if (r.tipo === "orientacao") continue;
    const add = (chave: string, rotulo: string, ini: number, fimJanela: number, data = dia) => {
      if (!vigenteEm(r, data)) return;
      const execucao = feito.get(`${r.id}|${data}|${chave}`);
      const status: StatusOcorrencia = execucao ? "feito" : agoraMin > fimJanela ? "atrasado" : agoraMin >= ini ? "agora" : "proximo";
      out.push({ rotina: r, data, chave, rotulo, minutos: ini, status, execucao });
    };
    if (r.frequencia === "horarios") for (const h of r.horarios) { const hh = h.slice(0, 5); const m = minutos(hh); add(hh, hh, m - MARGEM, m + MARGEM); }
    else if (r.frequencia === "plantao") {
      // The 19h–07h shift belongs to its start date, including after midnight.
      if (agoraMin < 7 * 60) add("noturno", "Plantão noturno · noite anterior", -5 * 60, 7 * 60, anterior);
      add("diurno", "Plantão diurno", 7 * 60, 19 * 60);
      add("noturno", "Plantão noturno", 19 * 60, 31 * 60);
    }
    else add("dia", MOMENTOS[r.momento ?? ""] ?? "Hoje", 0, 24 * 60);
  }
  return out.sort((a, b) => a.minutos - b.minutos || a.rotina.residente_nome.localeCompare(b.rotina.residente_nome));
}

export function diaAnterior(dia: string) {
  const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Orientações fixas vigentes (ex.: "No banho: usar sabonete X"), mostradas como lembrete. */
export const orientacoesVigentes = (rotinas: RotinaCuidado[], dia: string) => rotinas.filter((r) => r.tipo === "orientacao" && vigenteEm(r, dia));

export const rotinaSchema = z.object({
  residente: z.string().uuid("Selecione o residente"),
  titulo: z.string().trim().min(1, "Informe o título").max(160),
  tipo: z.enum(["procedimento", "afericao", "orientacao"]),
  instrucoes: z.string().trim().max(4000),
  frequencia: z.enum(["horarios", "momento", "plantao"]),
  horarios: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido")).max(24),
  momento: z.string().nullable(),
  tipo_afericao: z.string().nullable(),
  dias_semana: z.array(z.number().int().min(0).max(6)),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o início"),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).superRefine((v, ctx) => {
  if (v.frequencia === "horarios" && !v.horarios.length) ctx.addIssue({ code: "custom", path: ["horarios"], message: "Informe ao menos um horário" });
  if (v.frequencia === "momento" && !v.momento) ctx.addIssue({ code: "custom", path: ["momento"], message: "Escolha o momento" });
  if (v.tipo === "afericao" && !v.tipo_afericao) ctx.addIssue({ code: "custom", path: ["tipo_afericao"], message: "Escolha o que será aferido" });
  if (v.fim && v.fim < v.inicio) ctx.addIssue({ code: "custom", path: ["fim"], message: "Fim antes do início" });
  if (pareceMedicamento(`${v.titulo} ${v.instrucoes}`)) ctx.addIssue({ code: "custom", path: ["titulo"], message: "Remédios são cadastrados no Mapa de Medicamentos" });
});

/** Data final a partir de uma duração em dias (início conta como dia 1). */
export function fimPorDuracao(inicio: string, dias: number) {
  const d = new Date(`${inicio}T12:00:00`); d.setDate(d.getDate() + dias - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Texto curto da frequência para listas. */
export function descreverFrequencia(r: Pick<RotinaCuidado, "frequencia" | "horarios" | "momento" | "dias_semana">) {
  const base = r.frequencia === "horarios" ? `${r.horarios.length}x ao dia (${r.horarios.map((h) => h.slice(0, 5)).join(", ")})`
    : r.frequencia === "plantao" ? "1x por plantão" : MOMENTOS[r.momento ?? ""] ?? "";
  return r.dias_semana?.length ? `${base} · ${r.dias_semana.map((d) => DIAS[d]).join(", ")}` : base;
}
