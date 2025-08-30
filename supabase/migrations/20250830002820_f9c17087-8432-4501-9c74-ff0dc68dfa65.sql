-- Corrigir a função redefinir_prontuarios_com_horario para usar fuso horário brasileiro
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
  
  -- Finalizar automaticamente prontuários em atraso do dia anterior
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      data_encerramento = now(),
      updated_at = now()
  WHERE data_ciclo < data_atual_brasil 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos apenas se chegou a hora no horário brasileiro
  IF agora_brasil >= timestamp_inicio_brasil THEN
    INSERT INTO prontuario_ciclos (residente_id, data_ciclo, status, data_inicio_efetivo, created_at, updated_at)
    SELECT 
      r.id,
      data_atual_brasil,
      'nao_iniciado',
      timestamp_inicio_brasil,
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

-- Também corrigir a função simples de redefinição
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_automatico()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  data_atual_brasil DATE;
  agora_brasil TIMESTAMPTZ;
BEGIN
  -- Calcular data atual no fuso horário brasileiro
  agora_brasil := now() AT TIME ZONE 'America/Sao_Paulo';
  data_atual_brasil := (agora_brasil)::DATE;
  
  -- Log da execução
  RAISE NOTICE 'Redefinindo status de prontuários automaticamente para data: % (Brasil)', data_atual_brasil;
  
  -- Finalizar automaticamente prontuários do dia anterior que ainda estão 'em_andamento'
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      data_encerramento = now(),
      updated_at = now()
  WHERE data_ciclo < data_atual_brasil 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos (apenas se não existir para hoje)
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

  RAISE NOTICE 'Prontuários redefinidos automaticamente com sucesso para %', data_atual_brasil;
END;
$function$;