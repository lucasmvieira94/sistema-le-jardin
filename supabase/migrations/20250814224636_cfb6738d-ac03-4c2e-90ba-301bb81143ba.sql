-- Corrigir search_path nas funções para resolver avisos de segurança

-- Atualizar função validar_codigo_funcionario com search_path seguro
CREATE OR REPLACE FUNCTION public.validar_codigo_funcionario(p_codigo character)
RETURNS TABLE(funcionario_id uuid, nome_completo text, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.nome_completo,
    true as valid
  FROM public.funcionarios f
  WHERE f.codigo_4_digitos = p_codigo
    AND f.ativo = true
  LIMIT 1;
  
  -- If no results, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false;
  END IF;
END;
$$;

-- Atualizar função verificar_limite_tentativas com search_path seguro
CREATE OR REPLACE FUNCTION public.verificar_limite_tentativas(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Atualizar função registrar_tentativa_codigo com search_path seguro
CREATE OR REPLACE FUNCTION public.registrar_tentativa_codigo(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.registro_tentativas (codigo_tentativa, ip_address)
  VALUES (p_codigo, p_ip_address)
  ON CONFLICT (ip_address) DO UPDATE SET
    tentativas = registro_tentativas.tentativas + 1,
    updated_at = now();
END;
$$;