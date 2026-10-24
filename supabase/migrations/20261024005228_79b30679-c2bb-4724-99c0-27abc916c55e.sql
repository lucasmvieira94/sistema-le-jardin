CREATE OR REPLACE FUNCTION public.portal_cuidados_residentes()
RETURNS TABLE(id uuid, nome_completo text, quarto text, data_nascimento date, condicoes_medicas text, responsavel_nome text, responsavel_telefone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_func uuid; v_tenant uuid;
BEGIN
  v_func := public.portal_cuidados_funcionario();
  IF v_func IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
  SELECT f.tenant_id INTO v_tenant FROM public.funcionarios f WHERE f.id = v_func;
  RETURN QUERY SELECT r.id, r.nome_completo::text, r.quarto::text, r.data_nascimento, r.condicoes_medicas::text, r.responsavel_nome::text, r.responsavel_telefone::text
  FROM public.residentes r
  WHERE r.ativo AND (v_tenant IS NULL OR r.tenant_id IS NULL OR r.tenant_id = v_tenant)
  ORDER BY r.nome_completo;
END $$;