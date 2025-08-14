-- Corrigir search_path nas funções de role que ainda não foram atualizadas

-- Atualizar função has_role com search_path seguro
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Atualizar função get_current_user_role com search_path seguro
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1
$$;