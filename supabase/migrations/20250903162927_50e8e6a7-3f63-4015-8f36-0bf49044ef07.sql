-- Criar função para buscar prontuários em atraso
CREATE OR REPLACE FUNCTION public.buscar_prontuarios_em_atraso()
RETURNS TABLE(
  ciclo_id uuid,
  residente_id uuid,
  residente_nome text,
  data_ciclo date,
  data_inicio_efetivo timestamp with time zone,
  horas_atraso integer,
  funcionario_iniciou text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  config_record RECORD;
  tempo_limite_horas INTEGER := 24; -- Padrão de 24 horas
BEGIN
  -- Buscar configurações de tempo limite
  SELECT * INTO config_record
  FROM public.configuracoes_prontuario
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    tempo_limite_horas := config_record.tempo_limite_horas;
  END IF;
  
  RETURN QUERY
  SELECT 
    pc.id as ciclo_id,
    pc.residente_id,
    r.nome_completo as residente_nome,
    pc.data_ciclo,
    pc.data_inicio_efetivo,
    EXTRACT(HOURS FROM (NOW() AT TIME ZONE 'America/Sao_Paulo' - 
      COALESCE(pc.data_inicio_efetivo, pc.data_ciclo + TIME '08:00:00')))::integer as horas_atraso,
    f.nome_completo as funcionario_iniciou
  FROM public.prontuario_ciclos pc
  JOIN public.residentes r ON pc.residente_id = r.id
  LEFT JOIN public.funcionarios f ON pc.funcionario_encerrou = f.id
  WHERE pc.status IN ('em_andamento', 'nao_iniciado')
    AND (
      -- Prontuários iniciados há mais tempo que o limite
      (pc.data_inicio_efetivo IS NOT NULL AND 
       pc.data_inicio_efetivo + INTERVAL '1 hour' * tempo_limite_horas < NOW() AT TIME ZONE 'America/Sao_Paulo')
      OR 
      -- Prontuários não iniciados do dia anterior
      (pc.data_inicio_efetivo IS NULL AND 
       pc.data_ciclo < (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE)
    )
  ORDER BY pc.data_ciclo DESC, horas_atraso DESC;
END;
$function$;

-- Criar função para finalizar prontuários em atraso (apenas para gestores)
CREATE OR REPLACE FUNCTION public.finalizar_prontuario_atraso_gestor(
  p_ciclo_id uuid,
  p_gestor_id uuid,
  p_justificativa text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gestor_valido boolean := false;
  ciclo_status character varying;
  residente_nome text;
  data_ciclo date;
BEGIN
  -- Validar se o usuário é gestor/admin
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO gestor_valido;
  
  IF NOT gestor_valido THEN
    RETURN QUERY SELECT false, 'Acesso negado. Apenas gestores podem finalizar prontuários em atraso.';
    RETURN;
  END IF;
  
  -- Verificar se a justificativa foi fornecida
  IF p_justificativa IS NULL OR TRIM(p_justificativa) = '' THEN
    RETURN QUERY SELECT false, 'Justificativa é obrigatória para finalizar prontuários em atraso.';
    RETURN;
  END IF;
  
  -- Verificar se o ciclo existe e está em atraso
  SELECT 
    pc.status,
    r.nome_completo,
    pc.data_ciclo
  INTO ciclo_status, residente_nome, data_ciclo
  FROM public.prontuario_ciclos pc
  JOIN public.residentes r ON pc.residente_id = r.id
  WHERE pc.id = p_ciclo_id;
  
  IF ciclo_status IS NULL THEN
    RETURN QUERY SELECT false, 'Ciclo de prontuário não encontrado.';
    RETURN;
  END IF;
  
  IF ciclo_status = 'encerrado' THEN
    RETURN QUERY SELECT false, 'Este prontuário já foi finalizado.';
    RETURN;
  END IF;
  
  -- Finalizar o ciclo
  UPDATE public.prontuario_ciclos
  SET 
    status = 'encerrado',
    data_encerramento = NOW() AT TIME ZONE 'America/Sao_Paulo',
    funcionario_encerrou = p_gestor_id,
    updated_at = NOW()
  WHERE id = p_ciclo_id;
  
  -- Registrar na auditoria com justificativa detalhada
  INSERT INTO public.audit_log (
    user_id,
    tabela,
    operacao,
    dados_novos
  ) VALUES (
    auth.uid(),
    'prontuario_ciclos',
    'FINALIZADO_ATRASO_GESTOR',
    jsonb_build_object(
      'ciclo_id', p_ciclo_id,
      'residente_nome', residente_nome,
      'data_ciclo', data_ciclo,
      'status_anterior', ciclo_status,
      'status_novo', 'encerrado',
      'gestor_id', p_gestor_id,
      'justificativa', p_justificativa,
      'data_finalizacao_gestor', NOW() AT TIME ZONE 'America/Sao_Paulo',
      'tipo_finalizacao', 'atraso_gestor'
    )
  );
  
  RETURN QUERY SELECT true, 'Prontuário em atraso finalizado com sucesso pelo gestor.';
END;
$function$;