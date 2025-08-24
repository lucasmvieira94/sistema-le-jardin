-- Corrigir a função verificar_prontuario_diario_existente
-- O problema é que a função está retornando um tipo inconsistente na coluna 3 (status)

DROP FUNCTION IF EXISTS public.verificar_prontuario_diario_existente(uuid, date);

CREATE OR REPLACE FUNCTION public.verificar_prontuario_diario_existente(
  p_residente_id uuid, 
  p_data date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  ja_iniciado boolean, 
  ciclo_id uuid, 
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN pc.id IS NOT NULL THEN true ELSE false END as ja_iniciado,
    pc.id as ciclo_id,
    CAST(COALESCE(pc.status, 'nao_iniciado') AS text) as status
  FROM prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id 
    AND pc.data_ciclo = p_data
  ORDER BY pc.created_at DESC
  LIMIT 1;
  
  -- Se não encontrou nenhum registro, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'nao_iniciado'::text;
  END IF;
END;
$function$;