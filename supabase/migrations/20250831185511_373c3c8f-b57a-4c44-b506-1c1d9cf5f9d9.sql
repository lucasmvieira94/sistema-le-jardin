-- Corrigir problema de status que volta para 'nao_iniciado'
-- O problema está na função redefinir_prontuarios_com_horario que pode interferir com prontuários em andamento

CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_com_horario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  config_record RECORD;
  horario_inicio TIME;
  data_atual_brasil DATE;
  timestamp_inicio_brasil TIMESTAMPTZ;
  agora_brasil TIMESTAMPTZ;
BEGIN
  -- Calcular data e hora atuais no fuso horário brasileiro
  agora_brasil := now() AT TIME ZONE 'America/Sao_Paulo';
  data_atual_brasil := (agora_brasil)::DATE;
  
  -- Buscar configurações mais recentes
  SELECT * INTO config_record
  FROM public.configuracoes_prontuario
  ORDER BY created_at DESC
  LIMIT 1;
  
  horario_inicio := COALESCE(config_record.horario_inicio_ciclo, '08:00:00'::TIME);
  
  -- Criar timestamp do início no horário brasileiro
  timestamp_inicio_brasil := (data_atual_brasil + horario_inicio) AT TIME ZONE 'America/Sao_Paulo';
  
  -- Log da execução
  RAISE NOTICE 'Redefinindo prontuários para % às % (Brasil)', data_atual_brasil, horario_inicio;
  RAISE NOTICE 'Hora atual Brasil: %, Hora início: %', agora_brasil, timestamp_inicio_brasil;
  
  -- Finalizar automaticamente APENAS prontuários do dia anterior que estão 'em_andamento'
  -- NUNCA alterar prontuários do dia atual para evitar conflitos
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      data_encerramento = now(),
      updated_at = now()
  WHERE data_ciclo < data_atual_brasil 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos apenas se:
  -- 1. Chegou a hora no horário brasileiro 
  -- 2. Não existe ciclo para hoje
  -- 3. NUNCA sobrescrever ciclos existentes
  IF agora_brasil >= timestamp_inicio_brasil THEN
    INSERT INTO prontuario_ciclos (residente_id, data_ciclo, status, created_at, updated_at)
    SELECT 
      r.id,
      data_atual_brasil,
      'nao_iniciado',
      now(),
      now()
    FROM residentes r
    WHERE r.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM prontuario_ciclos pc 
        WHERE pc.residente_id = r.id 
          AND pc.data_ciclo = data_atual_brasil
      );
      
    RAISE NOTICE 'Novos prontuários criados para % no horário brasileiro', data_atual_brasil;
  ELSE
    RAISE NOTICE 'Ainda não chegou a hora de criar prontuários no Brasil (% < %)', agora_brasil, timestamp_inicio_brasil;
  END IF;
END;
$function$;

-- Também corrigir a função de inicialização para não resetar status existentes
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(p_residente_id uuid, p_funcionario_id uuid)
RETURNS TABLE(ciclo_id uuid, success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_ciclo_id uuid;
  existing_status character varying;
  new_ciclo_id uuid;
BEGIN
  -- Verificar se já existe prontuário para hoje
  SELECT vp.ciclo_id, vp.status 
  INTO existing_ciclo_id, existing_status
  FROM public.verificar_prontuario_diario_existente(p_residente_id, CURRENT_DATE) vp
  WHERE vp.ja_iniciado = true;
  
  -- Se já existe, retornar o ciclo existente e atualizar status APENAS se necessário
  IF existing_ciclo_id IS NOT NULL THEN
    -- Se o status for 'nao_iniciado', atualizar para 'em_andamento'
    IF existing_status = 'nao_iniciado' THEN
      UPDATE public.prontuario_ciclos 
      SET status = 'em_andamento', 
          data_inicio_efetivo = now(),
          updated_at = now()
      WHERE id = existing_ciclo_id;
      
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário iniciado com sucesso';
    -- Se já está em andamento, retornar sem alterar
    ELSIF existing_status = 'em_andamento' THEN
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário já iniciado, continuando...';
    -- Se já está completo, manter como está
    ELSIF existing_status = 'completo' THEN
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário já está completo';
    -- Se já foi encerrado, não permitir alteração
    ELSIF existing_status = 'encerrado' THEN
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário já foi finalizado hoje';
    ELSE
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário encontrado com status: ' || existing_status;
    END IF;
    
    RETURN;
  END IF;
  
  -- Criar novo ciclo apenas se não existir
  INSERT INTO public.prontuario_ciclos (
    data_ciclo, 
    residente_id, 
    status,
    data_inicio_efetivo
  )
  VALUES (
    CURRENT_DATE, 
    p_residente_id, 
    'em_andamento',
    now()
  )
  RETURNING id INTO new_ciclo_id;
  
  RETURN QUERY SELECT new_ciclo_id, true, 'Prontuário criado e iniciado com sucesso';
END;
$function$;