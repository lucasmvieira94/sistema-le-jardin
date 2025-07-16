import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRateLimit() {
  const [isBlocked, setIsBlocked] = useState(false);

  const checkRateLimit = async (codigo: string): Promise<boolean> => {
    try {
      // Get user's actual IP address from an external service
      let ipAddress = '127.0.0.1'; // fallback
      
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (ipError) {
        console.warn('Could not get real IP, using fallback:', ipError);
      }

      const { data, error } = await supabase.rpc('verificar_limite_tentativas', {
        p_codigo: codigo,
        p_ip_address: ipAddress
      });

      if (error) {
        console.error('Error checking rate limit:', error);
        return true; // Allow on error to not block legitimate users
      }

      const allowed = data as boolean;
      setIsBlocked(!allowed);

      if (!allowed) {
        // Log the failed attempt
        await supabase.rpc('registrar_tentativa_codigo', {
          p_codigo: codigo,
          p_ip_address: ipAddress
        });
      }

      return allowed;
    } catch (err) {
      console.error('Rate limit check error:', err);
      return true; // Allow on error
    }
  };

  return { checkRateLimit, isBlocked };
}