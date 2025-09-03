-- Remover a função duplicada que está causando ambiguidade
DROP FUNCTION IF EXISTS public.verificar_prontuario_diario_existente(p_residente_id uuid);

-- Manter apenas a versão com parâmetro de data com valor padrão
-- Ela já existe: verificar_prontuario_diario_existente(p_residente_id uuid, p_data date DEFAULT CURRENT_DATE)

-- Garantir que a função finalizar_prontuario_diario funcione corretamente
-- Verificar se retorna o formato correto
CREATE OR REPLACE FUNCTION public.finalizar_prontuario_diario(
  p_ciclo_id uuid, 
  p_funcionario_id uuid, 
  p_codigo_validacao character
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Verificar se o ciclo existe e não está encerrado
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
  
  -- Finalizar o ciclo com timezone brasileiro
  UPDATE public.prontuario_ciclos
  SET 
    status = 'encerrado',
    data_encerramento = NOW() AT TIME ZONE 'America/Sao_Paulo',
    funcionario_encerrou = p_funcionario_id,
    updated_at = NOW()
  WHERE id = p_ciclo_id;
  
  -- Registrar na auditoria
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
      'funcionario_encerrou', p_funcionario_id,
      'data_encerramento', NOW() AT TIME ZONE 'America/Sao_Paulo'
    )
  );
  
  RETURN QUERY SELECT true, 'Prontuário finalizado com sucesso';
END;
$function$;