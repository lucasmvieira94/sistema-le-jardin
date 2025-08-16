-- Adicionar função para verificar se já existe prontuário iniciado hoje para um residente
CREATE OR REPLACE FUNCTION public.verificar_prontuario_diario_existente(p_residente_id uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  ciclo_id uuid,
  status character varying,
  ja_iniciado boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id as ciclo_id,
    pc.status,
    true as ja_iniciado
  FROM public.prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id 
  AND pc.data_ciclo = p_data
  LIMIT 1;
  
  -- Se não encontrou nenhum registro, retorna que não foi iniciado
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::character varying, false;
  END IF;
END;
$$;

-- Adicionar função para iniciar prontuário diário
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(p_residente_id uuid, p_funcionario_id uuid)
RETURNS TABLE(
  ciclo_id uuid,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_ciclo_id uuid;
  existing_status character varying;
  new_ciclo_id uuid;
BEGIN
  -- Verificar se já existe prontuário para hoje
  SELECT vp.ciclo_id, vp.status 
  INTO existing_ciclo_id, existing_status
  FROM public.verificar_prontuario_diario_existente(p_residente_id) vp
  WHERE vp.ja_iniciado = true;
  
  -- Se já existe, retornar o ciclo existente
  IF existing_ciclo_id IS NOT NULL THEN
    RETURN QUERY SELECT existing_ciclo_id, true, 
      CASE 
        WHEN existing_status = 'em_andamento' THEN 'Prontuário já iniciado hoje, continuando...'
        WHEN existing_status = 'encerrado' THEN 'Prontuário já foi finalizado hoje'
        ELSE 'Prontuário encontrado com status: ' || existing_status
      END;
    RETURN;
  END IF;
  
  -- Criar novo ciclo
  INSERT INTO public.prontuario_ciclos (
    data_ciclo, 
    residente_id, 
    status
  )
  VALUES (
    CURRENT_DATE, 
    p_residente_id, 
    'em_andamento'
  )
  RETURNING id INTO new_ciclo_id;
  
  RETURN QUERY SELECT new_ciclo_id, true, 'Prontuário iniciado com sucesso';
END;
$$;

-- Adicionar função para finalizar prontuário com validação de código
CREATE OR REPLACE FUNCTION public.finalizar_prontuario_diario(
  p_ciclo_id uuid, 
  p_funcionario_id uuid, 
  p_codigo_validacao character
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  funcionario_valido boolean := false;
  ciclo_status character varying;
BEGIN
  -- Validar código do funcionário
  SELECT EXISTS(
    SELECT 1 FROM public.funcionarios 
    WHERE id = p_funcionario_id 
    AND codigo_4_digitos = p_codigo_validacao 
    AND ativo = true
  ) INTO funcionario_valido;
  
  IF NOT funcionario_valido THEN
    RETURN QUERY SELECT false, 'Código de funcionário inválido';
    RETURN;
  END IF;
  
  -- Verificar se o ciclo existe e está em andamento
  SELECT status INTO ciclo_status
  FROM public.prontuario_ciclos
  WHERE id = p_ciclo_id;
  
  IF ciclo_status IS NULL THEN
    RETURN QUERY SELECT false, 'Ciclo de prontuário não encontrado';
    RETURN;
  END IF;
  
  IF ciclo_status = 'encerrado' THEN
    RETURN QUERY SELECT false, 'Este prontuário já foi finalizado';
    RETURN;
  END IF;
  
  -- Finalizar o ciclo
  UPDATE public.prontuario_ciclos
  SET 
    status = 'encerrado',
    data_encerramento = now(),
    funcionario_encerrou = p_funcionario_id,
    updated_at = now()
  WHERE id = p_ciclo_id;
  
  -- Log da auditoria
  PERFORM public.log_audit_event(
    'prontuario_ciclos',
    'FINALIZADO',
    json_build_object('ciclo_id', p_ciclo_id, 'status_anterior', ciclo_status),
    json_build_object('ciclo_id', p_ciclo_id, 'status_novo', 'encerrado', 'funcionario_encerrou', p_funcionario_id)
  );
  
  RETURN QUERY SELECT true, 'Prontuário finalizado com sucesso';
END;
$$;