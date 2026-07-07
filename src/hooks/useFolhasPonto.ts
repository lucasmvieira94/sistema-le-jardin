import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Folhas de ponto individuais do funcionário (portal via PIN).
 * Usa RPC SECURITY DEFINER para permitir acesso sem JWT.
 */
export function useMinhasFolhasPonto(funcionarioId: string | null) {
  return useQuery({
    queryKey: ['minhas-folhas-ponto', funcionarioId],
    queryFn: async () => {
      if (!funcionarioId) return [];
      const { data, error } = await supabase.rpc('get_minhas_folhas_ponto', {
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        mes: number;
        ano: number;
        path: string;
        paginas: number | null;
        created_at: string;
      }>;
    },
    enabled: !!funcionarioId,
  });
}

export async function getFolhaPontoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('folhas-ponto')
    .createSignedUrl(path, 300);
  if (error) {
    console.error('Erro ao gerar signed URL da folha de ponto:', error);
    return null;
  }
  return data.signedUrl;
}