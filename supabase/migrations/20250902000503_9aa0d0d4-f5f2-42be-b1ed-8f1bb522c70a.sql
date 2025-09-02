-- Configurar timezone do Brasil para as funções de prontuário
-- Atualizar função criar_ciclo_prontuario_diario para usar timezone do Brasil

CREATE OR REPLACE FUNCTION public.criar_ciclo_prontuario_diario()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  residente_record RECORD;
  ciclo_id UUID;
  template_record RECORD;
  data_brasil DATE;
  horario_brasil TIME;
BEGIN
  -- Obter data e horário no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  horario_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::TIME;
  
  -- Para cada residente ativo
  FOR residente_record IN 
    SELECT id FROM public.residentes WHERE ativo = true
  LOOP
    -- Verificar se já existe ciclo para hoje (usando timezone do Brasil)
    IF NOT EXISTS (
      SELECT 1 FROM public.prontuario_ciclos 
      WHERE data_ciclo = data_brasil 
      AND residente_id = residente_record.id
    ) THEN
      -- Criar novo ciclo
      INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status)
      VALUES (data_brasil, residente_record.id, 'em_andamento')
      RETURNING id INTO ciclo_id;
      
      -- Criar registros obrigatórios baseados nos templates
      FOR template_record IN 
        SELECT * FROM public.prontuario_templates_obrigatorios 
        WHERE ativo = true 
        ORDER BY ordem
      LOOP
        INSERT INTO public.prontuario_registros (
          ciclo_id,
          residente_id,
          funcionario_id,
          data_registro,
          horario_registro,
          tipo_registro,
          titulo,
          descricao
        ) VALUES (
          ciclo_id,
          residente_record.id,
          NULL, -- Será preenchido quando o funcionário registrar
          data_brasil,
          horario_brasil,
          template_record.tipo_registro,
          template_record.titulo,
          COALESCE(template_record.descricao_padrao, '')
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

-- Atualizar função iniciar_prontuario_diario para usar timezone do Brasil
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(p_residente_id uuid, p_funcionario_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ciclo_id UUID;
  data_brasil DATE;
  horario_brasil TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obter data no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  horario_brasil := NOW() AT TIME ZONE 'America/Sao_Paulo';
  
  -- Verificar se já existe ciclo para hoje
  SELECT id INTO ciclo_id
  FROM public.prontuario_ciclos
  WHERE data_ciclo = data_brasil 
  AND residente_id = p_residente_id;
  
  -- Se não existe, criar novo ciclo
  IF ciclo_id IS NULL THEN
    INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status)
    VALUES (data_brasil, p_residente_id, 'em_andamento')
    RETURNING id INTO ciclo_id;
  ELSE
    -- Atualizar status para em_andamento apenas se estiver nao_iniciado
    UPDATE public.prontuario_ciclos 
    SET status = 'em_andamento',
        data_inicio_efetivo = horario_brasil,
        updated_at = NOW()
    WHERE id = ciclo_id 
    AND status = 'nao_iniciado';
  END IF;
  
  RETURN ciclo_id;
END;
$function$;

-- Atualizar função redefinir_prontuarios_com_horario para usar timezone do Brasil
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_com_horario()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  data_ontem DATE;
  data_brasil DATE;
BEGIN
  -- Obter datas no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  data_ontem := data_brasil - INTERVAL '1 day';
  
  -- Finalizar prontuários do DIA ANTERIOR que não foram finalizados
  UPDATE public.prontuario_ciclos 
  SET status = 'encerrado',
      data_encerramento = NOW() AT TIME ZONE 'America/Sao_Paulo',
      updated_at = NOW()
  WHERE data_ciclo = data_ontem
  AND status IN ('em_andamento', 'nao_iniciado');
  
  -- NÃO ALTERAR os prontuários de hoje
  -- Deixar que sigam o fluxo normal sem interferência
  
  RAISE NOTICE 'Finalizados prontuários do dia: %', data_ontem;
END;
$function$;

-- Atualizar função verificar_prontuario_diario_existente para usar timezone do Brasil
CREATE OR REPLACE FUNCTION public.verificar_prontuario_diario_existente(p_residente_id uuid)
 RETURNS TABLE(ciclo_id uuid, status text, data_ciclo date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  data_brasil DATE;
BEGIN
  -- Obter data no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  RETURN QUERY
  SELECT pc.id as ciclo_id, pc.status, pc.data_ciclo
  FROM public.prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id
  AND pc.data_ciclo = data_brasil;
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION public.criar_ciclo_prontuario_diario() IS 'Cria ciclos de prontuário diário usando timezone America/Sao_Paulo';
COMMENT ON FUNCTION public.iniciar_prontuario_diario(uuid, uuid) IS 'Inicia prontuário diário usando timezone America/Sao_Paulo';
COMMENT ON FUNCTION public.redefinir_prontuarios_com_horario() IS 'Redefine status dos prontuários usando timezone America/Sao_Paulo';
COMMENT ON FUNCTION public.verificar_prontuario_diario_existente(uuid) IS 'Verifica prontuário existente usando timezone America/Sao_Paulo';