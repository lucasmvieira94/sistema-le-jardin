import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compactarDescriptor } from '@/utils/biometria';

/** Situação da biometria do colaborador (sem expor os dados do rosto). */
export function useBiometriaStatus(funcionarioId: string | null) {
  return useQuery({
    queryKey: ['biometria-status', funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('biometria_status_funcionario', { p_funcionario_id: funcionarioId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return { cadastrada: !!row?.cadastrada, cadastradaEm: (row?.cadastrada_em ?? null) as string | null };
    },
  });
}

/** Autocadastro pelo portal: só funciona se ainda não houver biometria. */
export async function autocadastrarBiometria(funcionarioId: string, amostras: number[][]) {
  const { data, error } = await (supabase.rpc as any)('autocadastrar_biometria_funcionario', {
    p_funcionario_id: funcionarioId,
    p_amostras: amostras.map(compactarDescriptor),
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  return data as string;
}
