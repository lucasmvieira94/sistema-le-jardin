CREATE OR REPLACE FUNCTION public.portal_cadastrar_medicamento(
  p_residente_id uuid, p_nome text, p_dosagem text, p_horarios text[],
  p_via text DEFAULT NULL, p_prescrito_por text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL, p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_func uuid; v_nome_func text; v_tenant uuid; v_med uuid; v_presc uuid; v_h text[];
BEGIN
  v_func := public.portal_cuidados_funcionario();
  IF v_func IS NULL OR NOT ('medicamentos' = ANY(COALESCE(public.modulos_funcionario(v_func),'{}'))) THEN
    RAISE EXCEPTION 'Acesso não permitido' USING ERRCODE = '42501';
  END IF;
  SELECT nome, tenant_id INTO v_nome_func, v_tenant FROM funcionarios WHERE id = v_func;

  IF NOT EXISTS (SELECT 1 FROM residentes r WHERE r.id = p_residente_id AND r.ativo
                 AND (r.tenant_id IS NULL OR v_tenant IS NULL OR r.tenant_id = v_tenant)) THEN
    RAISE EXCEPTION 'Residente não encontrado';
  END IF;
  IF length(trim(coalesce(p_nome,''))) < 2 OR length(p_nome) > 120 THEN RAISE EXCEPTION 'Informe o nome do medicamento'; END IF;
  IF length(trim(coalesce(p_dosagem,''))) < 1 OR length(p_dosagem) > 80 THEN RAISE EXCEPTION 'Informe a dose'; END IF;
  SELECT array_agg(DISTINCT h ORDER BY h) INTO v_h FROM unnest(p_horarios) h WHERE h ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  IF v_h IS NULL THEN RAISE EXCEPTION 'Informe ao menos um horário válido'; END IF;
  IF p_data_fim IS NOT NULL AND p_data_fim < coalesce(p_data_inicio, (now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    RAISE EXCEPTION 'Data de término anterior ao início';
  END IF;

  SELECT id INTO v_med FROM medicamentos
   WHERE lower(trim(nome)) = lower(trim(p_nome)) AND coalesce(ativo,true)
     AND (tenant_id IS NOT DISTINCT FROM v_tenant OR tenant_id IS NULL) LIMIT 1;
  IF v_med IS NULL THEN
    INSERT INTO medicamentos (nome, dosagem, tenant_id, observacoes)
    VALUES (trim(p_nome), trim(p_dosagem), v_tenant, 'Cadastrado no Portal de Cuidados por ' || v_nome_func)
    RETURNING id INTO v_med;
  END IF;

  INSERT INTO prescricoes_medicamentos (residente_id, medicamento_id, dosagem, frequencia_tipo, horarios,
    via_administracao, prescrito_por, data_inicio, data_fim, observacoes, tenant_id)
  VALUES (p_residente_id, v_med, trim(p_dosagem), 'hora_fixa_diaria', v_h, nullif(trim(p_via),''),
    nullif(trim(p_prescrito_por),''), coalesce(p_data_inicio, (now() AT TIME ZONE 'America/Sao_Paulo')::date), p_data_fim,
    trim(coalesce(p_observacoes,'') || ' [Cadastrado por ' || v_nome_func || ' no Portal de Cuidados em '
      || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ']'), v_tenant)
  RETURNING id INTO v_presc;
  RETURN v_presc;
END $$;
REVOKE ALL ON FUNCTION public.portal_cadastrar_medicamento(uuid,text,text,text[],text,text,date,date,text) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_cadastrar_medicamento(uuid,text,text,text[],text,text,date,date,text) TO anon, authenticated;