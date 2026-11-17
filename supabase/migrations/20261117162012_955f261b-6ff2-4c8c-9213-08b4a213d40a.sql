ALTER TABLE public.remocoes_estoque_medicamentos ALTER COLUMN residente_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.portal_solicitar_remocao_estoque(p_estoque_id uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_t uuid; e record; v_id uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = v_f;
  IF length(trim(coalesce(p_motivo,''))) < 10 OR length(p_motivo) > 500 THEN
    RAISE EXCEPTION 'Justifique a remoção (mínimo 10 letras)'; END IF;
  SELECT * INTO e FROM estoque_medicamentos WHERE id = p_estoque_id AND tipo_estoque IN ('residente','urgencia') AND coalesce(ativo,true);
  IF e.id IS NULL THEN RAISE EXCEPTION 'Medicamento não está no estoque'; END IF;
  IF e.tipo_estoque = 'urgencia' THEN
    IF NOT coalesce(public.portal_eh_supervisor(), false) THEN RAISE EXCEPTION 'Somente supervisores' USING ERRCODE='42501'; END IF;
    IF e.tenant_id IS NOT NULL AND v_t IS NOT NULL AND e.tenant_id <> v_t THEN RAISE EXCEPTION 'Medicamento não está no estoque'; END IF;
  ELSE
    PERFORM public.portal_med_residente_ok(e.residente_id, v_t);
  END IF;
  INSERT INTO remocoes_estoque_medicamentos (estoque_medicamento_id, residente_id, solicitado_por, motivo, quantidade_no_pedido, tenant_id)
  VALUES (e.id, e.residente_id, v_f, trim(p_motivo), e.quantidade_atual, coalesce(e.tenant_id, v_t)) RETURNING id INTO v_id;
  UPDATE estoque_medicamentos SET ativo = false WHERE id = e.id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.gestor_remocoes_estoque(p_status text DEFAULT 'pendente')
RETURNS TABLE(id uuid, residente text, medicamento text, quantidade numeric, motivo text, solicitante text,
  status text, created_at timestamptz, revisado_em timestamptz, observacao_gestor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT coalesce(public.eh_gestor(auth.uid()), false) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT x.id, coalesce(r.nome_completo, 'Estoque de emergência'),
    m.nome || coalesce(' · Lote ' || e.lote, ''), x.quantidade_no_pedido, x.motivo, f.nome_completo,
    x.status, x.created_at, x.revisado_em, x.observacao_gestor
  FROM remocoes_estoque_medicamentos x
  JOIN estoque_medicamentos e ON e.id = x.estoque_medicamento_id
  JOIN medicamentos m ON m.id = e.medicamento_id
  LEFT JOIN residentes r ON r.id = x.residente_id
  LEFT JOIN funcionarios f ON f.id = x.solicitado_por
  WHERE x.status = p_status AND (x.tenant_id IS NULL OR public.has_tenant_access(x.tenant_id))
  ORDER BY x.created_at DESC LIMIT 200;
END $$;