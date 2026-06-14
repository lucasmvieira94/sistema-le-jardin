import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

const TZ = 'America/Sao_Paulo';

/**
 * Formata um timestamp (ISO/UTC) para dd/MM/yyyy no fuso de Brasília.
 */
export function formatarTimestampData(ts: string | Date): string {
  return formatInTimeZone(new Date(ts), TZ, 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Formata um timestamp (ISO/UTC) para dd/MM/yyyy HH:mm no fuso de Brasília.
 */
export function formatarTimestampDataHora(ts: string | Date): string {
  return formatInTimeZone(new Date(ts), TZ, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

/**
 * Formata um timestamp (ISO/UTC) para HH:mm no fuso de Brasília.
 */
export function formatarTimestampHora(ts: string | Date): string {
  return formatInTimeZone(new Date(ts), TZ, 'HH:mm', { locale: ptBR });
}