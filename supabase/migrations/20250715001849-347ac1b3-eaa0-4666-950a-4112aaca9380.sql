-- Security fixes migration: Add user roles, audit logging, rate limiting, and proper RLS

-- 1. Create user roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 2. Add user_id to funcionarios table for ownership
ALTER TABLE public.funcionarios 
ADD COLUMN user_id UUID;

-- 3. Create rate limiting table for registration attempts
CREATE TABLE public.registro_tentativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_tentativa VARCHAR(4) NOT NULL,
  ip_address INET,
  tentativas INTEGER DEFAULT 1,
  bloqueado_ate TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 6. Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 7. Function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;

-- 8. Drop existing permissive policies
DROP POLICY IF EXISTS "Permitir acesso total aos registros de ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Permite select para usuarios autenticados" ON public.funcionarios;
DROP POLICY IF EXISTS "Permite insert para usuarios autenticados" ON public.funcionarios;
DROP POLICY IF EXISTS "Permite update para usuarios autenticados" ON public.funcionarios;
DROP POLICY IF EXISTS "Permite select para usuarios autenticados" ON public.escalas;
DROP POLICY IF EXISTS "Permite insert para usuarios autenticados" ON public.escalas;

-- 9. Create secure RLS policies for funcionarios
CREATE POLICY "Admins can view all funcionarios" ON public.funcionarios
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their own funcionario record" ON public.funcionarios
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can insert funcionarios" ON public.funcionarios
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update funcionarios" ON public.funcionarios
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 10. Create secure RLS policies for registros_ponto
CREATE POLICY "Admins can view all registros_ponto" ON public.registros_ponto
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their own registros_ponto" ON public.registros_ponto
FOR SELECT USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employees can insert their own registros_ponto" ON public.registros_ponto
FOR INSERT WITH CHECK (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employees can update their own registros_ponto" ON public.registros_ponto
FOR UPDATE USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert any registros_ponto" ON public.registros_ponto
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any registros_ponto" ON public.registros_ponto
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 11. Create secure RLS policies for escalas
CREATE POLICY "Authenticated users can view escalas" ON public.escalas
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert escalas" ON public.escalas
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update escalas" ON public.escalas
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete escalas" ON public.escalas
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 12. Create secure RLS policies for afastamentos
CREATE POLICY "Admins can view all afastamentos" ON public.afastamentos
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their own afastamentos" ON public.afastamentos
FOR SELECT USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage afastamentos" ON public.afastamentos
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 13. RLS policies for user_roles
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user_roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 14. RLS policies for registro_tentativas (admin only)
CREATE POLICY "Admins can manage registro_tentativas" ON public.registro_tentativas
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 15. RLS policies for audit_log (admin only)
CREATE POLICY "Admins can view audit_log" ON public.audit_log
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 16. Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_tabela TEXT,
  p_operacao TEXT,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
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

-- 17. Function to check and manage rate limiting
CREATE OR REPLACE FUNCTION public.verificar_limite_tentativas(
  p_codigo VARCHAR(4),
  p_ip_address INET DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
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

-- 18. Function to log registration attempts
CREATE OR REPLACE FUNCTION public.registrar_tentativa_codigo(
  p_codigo VARCHAR(4),
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE PLPGSQL
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

-- 19. Add unique constraint for IP-based rate limiting
ALTER TABLE public.registro_tentativas 
ADD CONSTRAINT unique_ip_address UNIQUE (ip_address);

-- 20. Insert admin role for existing admin user (if any authenticated users exist)
-- This will need to be updated manually for the specific admin user