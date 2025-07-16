-- Security fixes migration

-- 1. Clean up conflicting RLS policies
DROP POLICY IF EXISTS "Permite select para usuarios autenticados" ON public.afastamentos;
DROP POLICY IF EXISTS "Permite insert para usuarios autenticados" ON public.afastamentos;
DROP POLICY IF EXISTS "Permite update para usuarios autenticados" ON public.afastamentos;
DROP POLICY IF EXISTS "Permite delete para usuarios autenticados" ON public.afastamentos;

-- 2. Fix database function security by adding SET search_path = ''
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event(p_tabela text, p_operacao text, p_dados_anteriores jsonb DEFAULT NULL::jsonb, p_dados_novos jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    tabela,
    operacao,
    dados_anteriores,
    dados_novos
  ) VALUES (
    auth.uid(),
    p_tabela,
    p_operacao,
    p_dados_anteriores,
    p_dados_novos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_limite_tentativas(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  tentativas_count INTEGER;
  bloqueado_ate TIMESTAMPTZ;
BEGIN
  -- Check if IP is currently blocked
  SELECT bloqueado_ate INTO bloqueado_ate
  FROM public.registro_tentativas
  WHERE ip_address = p_ip_address
    AND bloqueado_ate > now()
  LIMIT 1;
  
  IF bloqueado_ate IS NOT NULL THEN
    RETURN FALSE; -- Still blocked
  END IF;
  
  -- Get current attempt count for this IP in the last hour
  SELECT COALESCE(SUM(tentativas), 0) INTO tentativas_count
  FROM public.registro_tentativas
  WHERE ip_address = p_ip_address
    AND created_at > now() - INTERVAL '1 hour';
  
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

CREATE OR REPLACE FUNCTION public.registrar_tentativa_codigo(p_codigo character varying, p_ip_address inet DEFAULT NULL::inet)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.registro_tentativas (codigo_tentativa, ip_address)
  VALUES (p_codigo, p_ip_address)
  ON CONFLICT (ip_address) DO UPDATE SET
    tentativas = registro_tentativas.tentativas + 1,
    updated_at = now();
END;
$$;

-- Fix calculation functions with proper security
CREATE OR REPLACE FUNCTION public.calcular_horas_trabalhadas(p_entrada time without time zone, p_saida time without time zone, p_intervalo_inicio time without time zone DEFAULT NULL::time without time zone, p_intervalo_fim time without time zone DEFAULT NULL::time without time zone)
RETURNS interval
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  horas_totais INTERVAL;
  intervalo_duracao INTERVAL;
BEGIN
  -- Se não há entrada ou saída, retorna 0
  IF p_entrada IS NULL OR p_saida IS NULL THEN
    RETURN INTERVAL '0 hours';
  END IF;
  
  -- Calcula total de horas
  horas_totais := p_saida - p_entrada;
  
  -- Se há intervalo, subtrai do total
  IF p_intervalo_inicio IS NOT NULL AND p_intervalo_fim IS NOT NULL THEN
    intervalo_duracao := p_intervalo_fim - p_intervalo_inicio;
    horas_totais := horas_totais - intervalo_duracao;
  END IF;
  
  RETURN horas_totais;
END;
$$;

CREATE OR REPLACE FUNCTION public.eh_horario_noturno(p_horario time without time zone, p_inicio_noturno time without time zone DEFAULT '22:00:00'::time without time zone, p_fim_noturno time without time zone DEFAULT '05:00:00'::time without time zone)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Se início é menor que fim (ex: 22h às 5h do dia seguinte)
  IF p_inicio_noturno > p_fim_noturno THEN
    RETURN p_horario >= p_inicio_noturno OR p_horario <= p_fim_noturno;
  ELSE
    RETURN p_horario >= p_inicio_noturno AND p_horario <= p_fim_noturno;
  END IF;
END;
$$;

-- 3. Restrict configuracoes_empresa access to admins only
DROP POLICY IF EXISTS "Permitir acesso total às configurações da empresa" ON public.configuracoes_empresa;

CREATE POLICY "Admins can manage configuracoes_empresa"
ON public.configuracoes_empresa
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Add missing DELETE policies for all tables
CREATE POLICY "Admins can delete funcionarios"
ON public.funcionarios
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete registros_ponto"
ON public.registros_ponto
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete escalas"
ON public.escalas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete afastamentos"
ON public.afastamentos
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Ensure there's at least one admin user (you'll need to replace this email with an actual user email)
-- This will need to be updated with the actual admin user's ID after they sign up
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Try to find a user in auth.users (replace with actual admin email)
    SELECT id INTO admin_user_id 
    FROM auth.users 
    LIMIT 1;
    
    -- If a user exists, assign admin role
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (admin_user_id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;