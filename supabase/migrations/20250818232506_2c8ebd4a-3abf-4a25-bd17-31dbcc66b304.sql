-- Corrigir as funções com search_path
CREATE OR REPLACE FUNCTION public.update_formulario_campos_config_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;