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

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (active) {
          setIsSuperAdmin(!error && !!data);
          setLoading(false);
        }
      } catch {
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