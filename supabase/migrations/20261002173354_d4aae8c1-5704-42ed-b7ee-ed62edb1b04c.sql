CREATE OR REPLACE FUNCTION public.ciclo_jornada_dias(p_jornada text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_jornada WHEN '12x36' THEN 2 WHEN '24x48' THEN 3 WHEN '6x1' THEN 7 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.alterar_escala_funcionario(p_funcionario_id uuid, p_escala_id integer, p_data_inicio date, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tenant uuid; v_ant RECORD; v_ciclo int; v_operacao text := 'ALTERAR_ESCALA';
BEGIN
  PERFORM public.exigir_admin_escala();
  IF p_data_inicio IS NULL OR p_escala_id IS NULL THEN RAISE EXCEPTION 'Informe a escala e a data de início'; END IF;
  SELECT tenant_id INTO v_tenant FROM funcionarios WHERE id = p_funcionario_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM funcionarios_escalas_historico WHERE funcionario_id = p_funcionario_id AND data_inicio >= p_data_inicio) THEN
    RAISE EXCEPTION 'Já existe um período de escala começando nesta data ou depois. Corrija ou exclua esse período no histórico.';
  END IF;
  SELECT * INTO v_ant FROM funcionarios_escalas_historico
   WHERE funcionario_id = p_funcionario_id AND data_inicio < p_data_inicio AND (data_fim IS NULL OR data_fim >= p_data_inicio) LIMIT 1;
  IF FOUND THEN
    IF v_ant.escala_id = p_escala_id THEN
      -- Mesma escala: só permitido para mudar o dia do revezamento
      SELECT public.ciclo_jornada_dias(jornada_trabalho) INTO v_ciclo FROM escalas WHERE id = p_escala_id;
      IF COALESCE(v_ciclo, 0) = 0 THEN
        RAISE EXCEPTION 'O funcionário já está nesta escala nesta data';
      END IF;
      IF (p_data_inicio - v_ant.data_inicio) % v_ciclo = 0 THEN
        RAISE EXCEPTION 'Nesta data o funcionário já trabalharia pelo revezamento atual. Escolha um dia que mude a sequência.';
      END IF;
      IF NULLIF(trim(p_motivo), '') IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo da mudança de revezamento';
      END IF;
      v_operacao := 'MUDAR_REVEZAMENTO';
    END IF;
    UPDATE funcionarios_escalas_historico SET data_fim = p_data_inicio - 1 WHERE id = v_ant.id;
  END IF;
  INSERT INTO funcionarios_escalas_historico (funcionario_id, escala_id, tenant_id, data_inicio, motivo, criado_por)
  VALUES (p_funcionario_id, p_escala_id, v_tenant, p_data_inicio, NULLIF(trim(p_motivo), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.sincronizar_cache_escala(p_funcionario_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id)
  VALUES (auth.uid(), 'funcionarios_escalas_historico', v_operacao, to_jsonb(v_ant),
          jsonb_build_object('id', v_id, 'escala_id', p_escala_id, 'data_inicio', p_data_inicio, 'motivo', p_motivo), v_tenant);
  RETURN v_id;
END $$;