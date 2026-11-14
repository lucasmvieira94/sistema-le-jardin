import { z } from "zod";
import { hojeISO } from "./dateUtils";

export interface EventoCuidados {
  id: string; residente_id: string; residente_nome: string; titulo: string;
  data_evento: string; horario: string; observacoes: string | null;
  visto_em: string | null; visto_por_nome: string | null;
  cancelado_em?: string | null; motivo_cancelamento?: string | null;
}

export const eventoCuidadosSchema = z.object({
  residente: z.string().uuid("Selecione o residente"),
  titulo: z.string().trim().min(1, "Informe o compromisso").max(160),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data").refine((s) => {
    const d = new Date(`${s}T12:00:00`);
    return Number.isFinite(d.getTime()) && d.getFullYear() === Number(s.slice(0, 4)) && d.getMonth() + 1 === Number(s.slice(5, 7)) && d.getDate() === Number(s.slice(8, 10));
  }, "Data inválida"),
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário"),
  observacoes: z.string().trim().max(4000),
});

/** Ciência é compartilhada: eventos vistos continuam na agenda, mas não geram aviso. */
export function avisosAgenda(eventos: EventoCuidados[], dia = hojeISO()) {
  return eventos.filter((e) => e.data_evento === dia && e.visto_em === null && !e.cancelado_em);
}