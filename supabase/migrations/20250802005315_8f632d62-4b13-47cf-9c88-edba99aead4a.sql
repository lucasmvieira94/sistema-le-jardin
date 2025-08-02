-- Fix the ambiguous column reference in verificar_limite_tentativas function
CREATE OR REPLACE FUNCTION public.verificar_limite_tentativas(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  tentativas_count INTEGER;
  bloqueado_ate_atual TIMESTAMPTZ;
BEGIN
  -- Check if IP is currently blocked
  SELECT rt.bloqueado_ate INTO bloqueado_ate_atual
  FROM public.registro_tentativas rt
  WHERE rt.ip_address = p_ip_address
    AND rt.bloqueado_ate > now()
  LIMIT 1;
  
  IF bloqueado_ate_atual IS NOT NULL THEN
    RETURN FALSE; -- Still blocked
  END IF;
  
  -- Get current attempt count for this IP in the last hour
  SELECT COALESCE(SUM(rt.tentativas), 0) INTO tentativas_count
  FROM public.registro_tentativas rt
  WHERE rt.ip_address = p_ip_address
    AND rt.created_at > now() - INTERVAL '1 hour';
  
  -- If more than 5 attempts in last hour, block for 1 hour
  IF tentativas_count >= 5 THEN
    INSERT INTO public.registro_tentativas (codigo_tentativa, ip_address, bloqueado_ate)
    VALUES (p_codigo, p_ip_address, now() + INTERVAL '1 hour')
    ON CONFLICT (ip_address) DO UPDATE SET
      tentativas = registro_tentativas.tentativas + 1,
      bloqueado_ate = now() + INTERVAL '1 hour',
      updated_at = now();
    RETURN FALSE;
  END IF;
  
  RETURN TRUE; -- Allow attempt
END;
$function$