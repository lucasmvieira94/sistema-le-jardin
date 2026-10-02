import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocumentoFuncionario, TipoDocumentoInterno } from '@/utils/documentosInternos';

/** Lista unificada (advertências, folhas, contracheques, comunicados) do colaborador logado por código. */
export function useDocumentosFuncionario(funcionarioId: string | null) {
  return useQuery({
    queryKey: ['documentos-funcionario', funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async (): Promise<DocumentoFuncionario[]> => {
      const { data, error } = await (supabase.rpc as any)('listar_documentos_funcionario', {
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      return (data ?? []) as DocumentoFuncionario[];
    },
  });
}

export interface AssinarDocumentoInput {
  funcionarioId: string;
  tipo: TipoDocumentoInterno;
  referenciaId: string;
  hashDocumento: string;
  aceite: boolean;
  motivoRecusa?: string;
  distancia?: number;
  threshold?: number;
}

export async function assinarDocumentoInterno(i: AssinarDocumentoInput) {
  const { data, error } = await (supabase.rpc as any)('assinar_documento_interno', {
    p_funcionario_id: i.funcionarioId,
    p_tipo_documento: i.tipo,
    p_referencia_id: i.referenciaId,
    p_hash_documento: i.hashDocumento,
    p_aceite: i.aceite,
    p_motivo_recusa: i.motivoRecusa ?? null,
    p_distancia: i.distancia ?? null,
    p_threshold: i.threshold ?? null,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { id: string; hash_assinatura: string; assinado_em: string };
}
