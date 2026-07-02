CREATE OR REPLACE FUNCTION public.verificar_prontuario_diario_existente(p_residente_id uuid, p_data date DEFAULT NULL)
RETURNS TABLE(ja_iniciado boolean, ciclo_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  data_ref DATE;
BEGIN
  -- Usar timezone do Brasil por padrão para alinhar com criar_ciclo_prontuario_diario
  data_ref := COALESCE(p_data, (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE);

  RETURN QUERY
  SELECT 
    CASE WHEN pc.id IS NOT NULL THEN true ELSE false END as ja_iniciado,
    pc.id as ciclo_id,
    CAST(COALESCE(pc.status, 'nao_iniciado') AS text) as status
  FROM prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id 
    AND pc.data_ciclo = data_ref
  ORDER BY pc.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'nao_iniciado'::text;
  END IF;
END;
$function$;