/**
 * Utilitário centralizado de datas para o sistema.
 * Fuso horário padrão: America/Sao_Paulo (Brasília, UTC-3)
 * Formato padrão de exibição: DD/MM/YYYY
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual no fuso de Brasília como objeto Date.
 */
export function agora(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Retorna a data atual no fuso de Brasília no formato 'yyyy-MM-dd'.
 * Útil para queries no Supabase.
 */
export function hojeISO(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Retorna a data/hora atual no fuso de Brasília como ISO string completa.
 * Útil para campos updated_at, created_at.
 */
export function agoraISO(): string {
  return new Date().toISOString();
}

/**
 * Retorna o horário atual no fuso de Brasília no formato 'HH:mm:ss'.
 */
export function horarioAtual(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'HH:mm:ss');
}

/**
 * Retorna o horário atual no fuso de Brasília no formato 'HH:mm'.
 */
export function horarioAtualCurto(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'HH:mm');
}

/**
 * Formata uma string de data (yyyy-MM-dd ou ISO) para DD/MM/YYYY.
 * Trata o problema de timezone adicionando T12:00:00 para datas sem hora.
 */
export function formatarData(data: string): string {
  const dataCorrigida = data.length === 10 ? `${data}T12:00:00` : data;
  return format(new Date(dataCorrigida), 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Formata uma string de data para DD/MM/YYYY HH:mm.
 */
export function formatarDataHora(data: string): string {
  return formatInTimeZone(new Date(data), TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

/**
 * Formata uma string de data para formato extenso: "dd de MMMM de yyyy".
 */
export function formatarDataExtenso(data: string): string {
  const dataCorrigida = data.length === 10 ? `${data}T12:00:00` : data;
  return format(new Date(dataCorrigida), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Formata a data atual por extenso.
 */
export function hojeExtenso(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Formata data para exibição curta com dia da semana: "seg, 01/04".
 */
export function formatarDataCurta(data: string): string {
  const dataCorrigida = data.length === 10 ? `${data}T12:00:00` : data;
  const d = new Date(dataCorrigida);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/**
 * Formata data para exibição com dia da semana e ano completo.
 */
export function formatarDataCompleta(data: string): string {
  const dataCorrigida = data.length === 10 ? `${data}T12:00:00` : data;
  return format(new Date(dataCorrigida), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Retorna o mês/ano atual por extenso: "abril de 2026"
 */
export function mesAnoAtual(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Converte uma data ISO (yyyy-MM-dd) para Date corrigida para timezone local.
 */
export function parseDataLocal(data: string): Date {
  return new Date(data.length === 10 ? `${data}T12:00:00` : data);
}

/**
 * Retorna a data atual formatada para datetime-local input (yyyy-MM-ddTHH:mm).
 */
export function agoraDatetimeLocal(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Retorna o primeiro dia do mês atual no formato yyyy-MM-dd.
 */
export function inicioMesAtualISO(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-01');
}
