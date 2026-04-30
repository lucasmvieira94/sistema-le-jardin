import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from '@/hooks/useAuthSession';

/**
 * Verifica se o usuário autenticado é super-admin da plataforma SaaS.
 * Cacheado com React Query — evita repetição entre componentes/navegações.
 */
export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuthSession();

  const { data, isLoading } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_super_admin');
      if (error) {
        console.error('Erro ao verificar super-admin:', error);
        return false;
      }
      return data === true;
    },
  });

  return {
    isSuperAdmin: data === true,
    loading: authLoading || (!!user && isLoading),
  };
}