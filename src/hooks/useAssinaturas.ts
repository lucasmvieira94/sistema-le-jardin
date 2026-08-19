/**
 * Hooks de gestão de assinaturas eletrônicas (lado autenticado).
 *
 * Base legal: MP 2.200-2/2001 (art. 10, §2º) e Lei 14.063/2020 — assinatura
 * eletrônica simples/avançada, válida entre as partes quando há comprovação
 * de autoria (OTP/biometria) e de integridade (hash SHA-256 + auditoria).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PapelSignatario = 'empresa' | 'funcionario' | 'cliente' | 'responsavel' | 'testemunha';
export type MetodoAssinatura = 'otp_email' | 'otp_sms' | 'biometria_facial' | 'rubrica_empresa';
export type StatusEnvelope =
  | 'rascunho' | 'aguardando' | 'parcial' | 'concluido' | 'recusado' | 'cancelado' | 'expirado';

export interface SignatarioInput {
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  papel: PapelSignatario;
  metodo: MetodoAssinatura;
  funcionario_id?: string | null;
  ordem?: number;
}

export interface CriarEnvelopeInput {
  titulo: string;
  tipo: string;
  conteudo_html: string;
  mensagem?: string | null;
  referencia_id?: string | null;
  referencia_tabela?: string | null;
  documento_emitido_id?: string | null;
  tenant_id?: string | null;
  expira_em_dias?: number;
  signatarios: SignatarioInput[];
}

export interface Signatario {
  id: string;
  envelope_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  papel: PapelSignatario;
  metodo: MetodoAssinatura;
  ordem: number;
  status: string;
  token: string;
  assinado_em: string | null;
  recusado_em: string | null;
  motivo_recusa: string | null;
  hash_assinatura: string | null;
  ip_origem: string | null;
  user_agent: string | null;
  geolocalizacao: any;
  rubrica_base64: string | null;
}

export interface Envelope {
  id: string;
  titulo: string;
  tipo: string;
  status: StatusEnvelope;
  hash_documento: string;
  conteudo_html: string | null;
  mensagem: string | null;
  expira_em: string;
  concluido_em: string | null;
  created_at: string;
  assinatura_signatarios: Signatario[];
}

/** Lista os envelopes do tenant com seus signatários. */
export function useEnvelopes() {
  return useQuery({
    queryKey: ['assinatura-envelopes'],
    queryFn: async (): Promise<Envelope[]> => {
      const { data, error } = await supabase
        .from('assinatura_envelopes')
        .select('*, assinatura_signatarios(*)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Envelope[];
    },
  });
}

/** Trilha de auditoria de um envelope. */
export function useEventosEnvelope(envelopeId?: string | null) {
  return useQuery({
    queryKey: ['assinatura-eventos', envelopeId],
    enabled: !!envelopeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinatura_eventos')
        .select('*')
        .eq('envelope_id', envelopeId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function invocar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('assinatura-envelope', {
    body: { ...body, base_url: window.location.origin },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export function useCriarEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarEnvelopeInput) => invocar({ action: 'criar', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assinatura-envelopes'] }),
  });
}

export function useReenviarConvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signatario_id: string) => invocar({ action: 'reenviar', signatario_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assinatura-envelopes'] }),
  });
}

export function useCancelarEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { envelope_id: string; motivo: string }) => invocar({ action: 'cancelar', ...vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assinatura-envelopes'] }),
  });
}

/** Link público de assinatura de um signatário. */
export const linkAssinatura = (token: string) => `${window.location.origin}/assinar/${token}`;

export const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando assinaturas',
  parcial: 'Parcialmente assinado',
  concluido: 'Concluído',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
  pendente: 'Pendente',
  enviado: 'Convite enviado',
  visualizado: 'Visualizado',
  assinado: 'Assinado',
};

export const METODO_LABEL: Record<MetodoAssinatura, string> = {
  otp_email: 'Código por e-mail',
  otp_sms: 'Código por WhatsApp',
  biometria_facial: 'Biometria facial',
  rubrica_empresa: 'Rubrica da empresa',
};

export const TIPO_LABEL: Record<string, string> = {
  contrato_residente: 'Contrato de residente',
  contrato_temporario: 'Contrato temporário',
  advertencia: 'Advertência / suspensão',
  folha_ponto: 'Folha de ponto',
  contracheque: 'Contracheque',
  recibo_pagamento: 'Recibo de pagamento',
  recibo_despesa: 'Recibo de despesa',
  outro: 'Outro documento',
};
