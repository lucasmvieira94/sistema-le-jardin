import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from './useAuthSession';

/**
 * Verifica se o usuário autenticado tem role 'admin'.
 * Usa a sessão já carregada (sem getUser() extra) e cache do React Query
 * para evitar requisições repetidas a cada navegação.
 */
export function useUserRole() {
  const { user, loading: authLoading } = useAuthSession();

  const { data, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao verificar role:', error);
        return false;
      }
      return !!data;
    },
  });

  return {
    isAdmin: data === true,
    loading: authLoading || (!!user && isLoading),
  };
}