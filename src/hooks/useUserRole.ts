import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthSession } from './useAuthSession';

export type UserRole = 'admin' | 'employee' | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthSession();

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('employee'); // Default to employee if no role found
        } else {
          setRole(data.role);
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setRole('employee');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  return { role, loading, isAdmin, isEmployee };
}