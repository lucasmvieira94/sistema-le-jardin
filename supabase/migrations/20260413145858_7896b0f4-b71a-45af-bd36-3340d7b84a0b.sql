
CREATE OR REPLACE FUNCTION public.finalizar_todos_prontuarios_abertos(
  p_justificativa text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_count integer;
BEGIN
  -- Verificar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  -- Verificar se é admin
  v_is_admin := has_role(v_user_id, 'admin');
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Apenas administradores podem executar esta ação');
  END IF;

  -- Validar justificativa
  IF p_justificativa IS NULL OR trim(p_justificativa) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Justificativa é obrigatória');
  END IF;

  -- Encerrar todos os ciclos abertos
  WITH ciclos_atualizados AS (
    UPDATE prontuario_ciclos
    SET status = 'encerrado',
        data_encerramento = now()
    WHERE status IN ('em_andamento', 'nao_iniciado')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM ciclos_atualizados;

  -- Registrar no audit_log
  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos)
  VALUES (
    v_user_id,
    'prontuario_ciclos',
    'ENCERRAMENTO_LOTE',
    jsonb_build_object(
      'quantidade_encerrados', v_count,
      'justificativa', p_justificativa,
      'data_execucao', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('%s prontuário(s) encerrado(s) com sucesso', v_count),
    'count', v_count
  );
END;
$$;
