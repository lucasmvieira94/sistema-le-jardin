import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que verifica se o usuário autenticado é um super-admin da plataforma SaaS.
 * Super-admins têm acesso ao painel /admin-saas e podem gerenciar todos os tenants.
 */
export function useSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setIsSuperAdmin(false);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.rpc('is_super_admin');

        if (active) {
          if (error) {
            console.error('Erro ao verificar super-admin:', error);
          }
          setIsSuperAdmin(!error && data === true);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro inesperado ao verificar super-admin:', error);
        if (active) {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isSuperAdmin, loading };
}