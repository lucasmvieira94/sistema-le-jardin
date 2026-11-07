CREATE OR REPLACE FUNCTION public.portal_cuidados_agenda(_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)) RETURNS TABLE(id uuid,residente_id uuid,residente_nome text,titulo text,data_evento date,horario time,observacoes text,visto_em timestamptz,visto_por_nome text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE funcionarios.id=v;
 RETURN QUERY SELECT a.id,a.residente_id,r.nome_completo::text,a.titulo,a.data_evento,a.horario,a.observacoes,a.visto_em,f.nome_completo::text FROM public.cuidados_agenda a JOIN public.residentes r ON r.id=a.residente_id LEFT JOIN public.funcionarios f ON f.id=a.visto_por WHERE a.tenant_id IS NOT DISTINCT FROM t AND a.data_evento=_data ORDER BY a.horario,a.created_at;
END $$;