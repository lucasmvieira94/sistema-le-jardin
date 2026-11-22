CREATE OR REPLACE FUNCTION public.portal_supervisao_intercorrencias()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.funcionarios; resultado jsonb;
BEGIN
 SELECT * INTO f FROM public.funcionarios WHERE id=public.portal_funcionario_atual() AND ativo;
 IF f.id IS NULL OR NOT ('supervisor'=ANY(COALESCE(public.modulos_funcionario(f.id),'{}'::text[]))) THEN RAISE EXCEPTION 'Acesso à supervisão não autorizado' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO resultado FROM (
 SELECT i.id,i.titulo,i.descricao,i.categoria,i.prioridade,i.status,i.funcionario_id,i.residente_id,i.prazo_resolucao,i.data_resolucao,i.feedback_gestor,i.feedback_data,i.feedback_por,i.imagens,i.created_at,i.updated_at,
 jsonb_build_object('nome_completo',fu.nome_completo) funcionarios,jsonb_build_object('nome_completo',r.nome_completo) residentes
 FROM public.intercorrencias i LEFT JOIN public.funcionarios fu ON fu.id=i.funcionario_id AND fu.tenant_id IS NOT DISTINCT FROM f.tenant_id LEFT JOIN public.residentes r ON r.id=i.residente_id AND r.tenant_id IS NOT DISTINCT FROM f.tenant_id
 WHERE i.tenant_id IS NOT DISTINCT FROM f.tenant_id) x;
 RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.portal_supervisao_intercorrencias() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_supervisao_intercorrencias() TO anon,authenticated,service_role;