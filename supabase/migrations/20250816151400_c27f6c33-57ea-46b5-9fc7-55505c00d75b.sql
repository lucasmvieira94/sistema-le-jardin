-- Função para registrar eventos de auditoria já existe, mas vou ajustar a função de finalização
-- para remover a chamada que está causando erro

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
  
  -- Registrar na auditoria simplificado
  INSERT INTO public.audit_log (
    user_id,
    tabela,
    operacao,
    dados_novos
  ) VALUES (
    auth.uid(),
    'prontuario_ciclos',
    'FINALIZADO',
    jsonb_build_object(
      'ciclo_id', p_ciclo_id, 
      'status_novo', 'encerrado', 
      'funcionario_encerrou', p_funcionario_id
    )
  );
  
  RETURN QUERY SELECT true, 'Prontuário finalizado com sucesso';
END;
$$;