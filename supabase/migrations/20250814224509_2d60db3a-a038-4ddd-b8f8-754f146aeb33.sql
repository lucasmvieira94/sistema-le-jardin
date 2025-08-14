-- Remover políticas conflitantes e criar novas políticas para permitir registro de ponto sem autenticação

-- Primeiro, remover políticas desnecessárias que podem causar conflito
DROP POLICY IF EXISTS "Allow point insertion by funcionario code" ON public.registros_ponto;
DROP POLICY IF EXISTS "Allow point update by funcionario code" ON public.registros_ponto;
DROP POLICY IF EXISTS "Secure time record insertion" ON public.registros_ponto;
DROP POLICY IF EXISTS "Secure time record updates for active employees" ON public.registros_ponto;

-- Criar política para permitir SELECT de registros_ponto sem autenticação (para funcionários ativos)
CREATE POLICY "Allow select for active employees by funcionario_id" 
ON public.registros_ponto 
FOR SELECT 
USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  )
);

-- Criar política para permitir INSERT de registros_ponto sem autenticação (para funcionários ativos)
CREATE POLICY "Allow insert for active employees" 
ON public.registros_ponto 
FOR INSERT 
WITH CHECK (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  )
);

-- Criar política para permitir UPDATE de registros_ponto sem autenticação (para funcionários ativos)
CREATE POLICY "Allow update for active employees" 
ON public.registros_ponto 
FOR UPDATE 
USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  )
)
WITH CHECK (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  )
);

-- Permitir acesso de SELECT aos funcionários ativos sem autenticação
CREATE POLICY "Allow select funcionarios for validation" 
ON public.funcionarios 
FOR SELECT 
USING (ativo = true);

-- Atualizar a função validar_codigo_funcionario para não exigir autenticação
CREATE OR REPLACE FUNCTION public.validar_codigo_funcionario(p_codigo character)
RETURNS TABLE(funcionario_id uuid, nome_completo text, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com privilégios do criador da função
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

-- Atualizar função de rate limit para não exigir autenticação
CREATE OR REPLACE FUNCTION public.verificar_limite_tentativas(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Atualizar função registrar_tentativa_codigo para não exigir autenticação
CREATE OR REPLACE FUNCTION public.registrar_tentativa_codigo(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.registro_tentativas (codigo_tentativa, ip_address)
  VALUES (p_codigo, p_ip_address)
  ON CONFLICT (ip_address) DO UPDATE SET
    tentativas = registro_tentativas.tentativas + 1,
    updated_at = now();
END;
$$;