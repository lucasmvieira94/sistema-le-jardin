-- Corrigir a função iniciar_prontuario_diario para retornar o formato correto
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(
  p_residente_id uuid, 
  p_funcionario_id uuid
)
RETURNS TABLE(success boolean, message text, ciclo_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ciclo_id_var UUID;
  data_brasil DATE;
  horario_brasil TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obter data no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  horario_brasil := NOW() AT TIME ZONE 'America/Sao_Paulo';
  
  -- Verificar se já existe ciclo para hoje
  SELECT id INTO ciclo_id_var
  FROM public.prontuario_ciclos
  WHERE data_ciclo = data_brasil 
  AND residente_id = p_residente_id;
  
  -- Se não existe, criar novo ciclo
  IF ciclo_id_var IS NULL THEN
    INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status, data_inicio_efetivo)
    VALUES (data_brasil, p_residente_id, 'em_andamento', horario_brasil)
    RETURNING id INTO ciclo_id_var;
    
    RETURN QUERY SELECT true, 'Novo prontuário iniciado com sucesso'::text, ciclo_id_var;
  ELSE
    -- Atualizar status para em_andamento se estiver nao_iniciado
    UPDATE public.prontuario_ciclos 
    SET status = 'em_andamento',
        data_inicio_efetivo = COALESCE(data_inicio_efetivo, horario_brasil),
        updated_at = NOW()
    WHERE id = ciclo_id_var 
    AND status = 'nao_iniciado';
    
    RETURN QUERY SELECT true, 'Prontuário existente atualizado'::text, ciclo_id_var;
  END IF;
END;
$function$;