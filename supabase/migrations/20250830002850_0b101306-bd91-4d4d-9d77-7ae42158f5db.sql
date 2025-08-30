-- Corrigir search_path das funções que estão sem
CREATE OR REPLACE FUNCTION public.update_configuracoes_prontuario_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;