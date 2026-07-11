import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FolhaPontoItem {
  id: string;
  mes: number;
  ano: number;
  path: string;
  paginas: number | null;
  created_at: string;
  confirmado: boolean | null;
  confirmado_at: string | null;
  motivo_discordancia: string | null;
  primeira_abertura_at: string | null;
}

/**
 * Folhas de ponto individuais do funcionário (portal via PIN).
 * Usa RPC SECURITY DEFINER para permitir acesso sem JWT.
 */
export function useMinhasFolhasPonto(funcionarioId: string | null) {
  return useQuery({
    queryKey: ['minhas-folhas-ponto', funcionarioId],
    queryFn: async () => {
      if (!funcionarioId) return [];
      const { data, error } = await (supabase.rpc as any)('get_minhas_folhas_ponto', {
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      return (data || []) as FolhaPontoItem[];
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

export async function marcarAberturaFolhaPonto(folhaId: string, funcionarioId: string) {
  await (supabase.rpc as any)('marcar_abertura_folha_ponto', {
    p_folha_id: folhaId,
    p_funcionario_id: funcionarioId,
  });
}

export async function confirmarFolhaPonto(params: {
  folhaId: string;
  funcionarioId: string;
  concorda: boolean;
  motivo?: string;
}) {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
  let ip: string | null = null;
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    if (r.ok) ip = (await r.json())?.ip ?? null;
  } catch {
    /* ignore */
  }
  const { data, error } = await (supabase.rpc as any)('confirmar_folha_ponto', {
    p_folha_id: params.folhaId,
    p_funcionario_id: params.funcionarioId,
    p_concorda: params.concorda,
    p_motivo: params.motivo ?? null,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) throw error;
  return data;
}