import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRateLimit() {
  const [isBlocked, setIsBlocked] = useState(false);

  const checkRateLimit = async (codigo: string): Promise<boolean> => {
    console.log('🛡️ Iniciando verificação de rate limit para código:', codigo);
    
    try {
      // Get user's actual IP address from an external service
      let ipAddress = '127.0.0.1'; // fallback
      
      try {
        console.log('🌐 Obtendo IP real...');
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
        console.log('📍 IP obtido:', ipAddress);
      } catch (ipError) {
        console.warn('⚠️ Não foi possível obter IP real, usando fallback:', ipError);
      }

      console.log('🔍 Verificando limite no Supabase...');
      const { data, error } = await supabase.rpc('verificar_limite_tentativas', {
        p_codigo: codigo,
        p_ip_address: ipAddress
      });

      console.log('📊 Resultado da verificação:', { data, error });

      if (error) {
        console.error('❌ Erro na verificação de rate limit:', error);
        return true; // Allow on error to not block legitimate users
      }

      const allowed = data as boolean;
      setIsBlocked(!allowed);
      console.log('🛡️ Rate limit permitido:', allowed);

      if (!allowed) {
        console.log('🚫 Registrando tentativa falhada...');
        // Log the failed attempt
        await supabase.rpc('registrar_tentativa_codigo', {
          p_codigo: codigo,
          p_ip_address: ipAddress
        });
      }

      return allowed;
    } catch (err) {
      console.error('❌ Erro geral na verificação de rate limit:', err);
      return true; // Allow on error
    }
  };

  return { checkRateLimit, isBlocked };
}