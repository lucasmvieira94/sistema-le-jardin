import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContrachequeAdmin {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  mes: number;
  ano: number;
  path: string;
  paginas: number | null;
  tamanho_bytes: number | null;
  created_at: string;
}

/**
 * Lista contracheques (admin) por mês/ano.
 */
export function useContrachequesAdmin(mes: number, ano: number) {
  return useQuery({
    queryKey: ['contracheques-admin', mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracheques')
        .select('*, funcionarios(nome)')
        .eq('mes', mes)
        .eq('ano', ano)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        funcionario_nome: c.funcionarios?.nome,
      })) as ContrachequeAdmin[];
    },
  });
}

/**
 * Contracheques do funcionário (área pública via PIN, usa RPC SECURITY DEFINER).
 */
export function useMeusContracheques(funcionarioId: string | null) {
  return useQuery({
    queryKey: ['meus-contracheques', funcionarioId],
    queryFn: async () => {
      if (!funcionarioId) return [];
      const { data, error } = await supabase.rpc('get_meus_contracheques', {
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

export function useDeleteContracheque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      const { error: sErr } = await supabase.storage.from('contracheques').remove([path]);
      if (sErr) throw sErr;
      const { error } = await supabase.from('contracheques').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracheques-admin'] }),
  });
}

/**
 * Gera signed URL para visualizar/baixar o holerite.
 */
export async function getContrachequeSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('contracheques')
    .createSignedUrl(path, 300); // 5 min
  if (error) {
    console.error('Erro ao gerar signed URL:', error);
    return null;
  }
  return data.signedUrl;
}
