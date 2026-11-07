CREATE TABLE public.cuidados_agenda (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, residente_id uuid NOT NULL REFERENCES public.residentes(id), titulo text NOT NULL, data_evento date NOT NULL, horario time NOT NULL, observacoes text, criado_por uuid NOT NULL REFERENCES public.funcionarios(id), visto_por uuid REFERENCES public.funcionarios(id), visto_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cuidados_agenda TO service_role;
ALTER TABLE public.cuidados_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages care agenda" ON public.cuidados_agenda FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX cuidados_agenda_dia_idx ON public.cuidados_agenda(tenant_id, data_evento, horario);
CREATE FUNCTION public.validar_cuidados_agenda() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF length(btrim(NEW.titulo)) NOT BETWEEN 1 AND 160 OR length(COALESCE(NEW.observacoes,'')) > 4000 THEN RAISE EXCEPTION 'Informe um compromisso válido e observações de até 4000 caracteres'; END IF;
 NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER cuidados_agenda_validar BEFORE INSERT OR UPDATE ON public.cuidados_agenda FOR EACH ROW EXECUTE FUNCTION public.validar_cuidados_agenda();
CREATE FUNCTION public.portal_cuidados_agenda(_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)) RETURNS TABLE(id uuid,residente_id uuid,residente_nome text,titulo text,data_evento date,horario time,observacoes text,visto_em timestamptz,visto_por_nome text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE funcionarios.id=v;
 RETURN QUERY SELECT a.id,a.residente_id,r.nome_completo::text,a.titulo,a.data_evento,a.horario,a.observacoes,a.visto_em,f.nome::text FROM public.cuidados_agenda a JOIN public.residentes r ON r.id=a.residente_id LEFT JOIN public.funcionarios f ON f.id=a.visto_por WHERE a.tenant_id IS NOT DISTINCT FROM t AND a.data_evento=_data ORDER BY a.horario,a.created_at;
END $$;
CREATE FUNCTION public.portal_cuidados_criar_evento(_residente_id uuid,_titulo text,_data date,_horario time,_observacoes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid; novo uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 IF _data IS NULL OR _horario IS NULL OR _titulo IS NULL OR length(btrim(_titulo)) NOT BETWEEN 1 AND 160 OR length(COALESCE(_observacoes,''))>4000 THEN RAISE EXCEPTION 'Informe residente, compromisso, data e horário válidos'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.residentes WHERE id=_residente_id AND ativo AND (tenant_id IS NOT DISTINCT FROM t OR tenant_id IS NULL)) THEN RAISE EXCEPTION 'Residente não disponível neste portal' USING ERRCODE='42501'; END IF;
 INSERT INTO public.cuidados_agenda(tenant_id,residente_id,titulo,data_evento,horario,observacoes,criado_por) VALUES(t,_residente_id,btrim(_titulo),_data,_horario,nullif(btrim(_observacoes),''),v) RETURNING id INTO novo; RETURN novo;
END $$;
CREATE FUNCTION public.portal_cuidados_ver_evento(_evento_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 IF NOT EXISTS(SELECT 1 FROM public.cuidados_agenda WHERE id=_evento_id AND tenant_id IS NOT DISTINCT FROM t AND data_evento=(now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN RAISE EXCEPTION 'Compromisso do dia não encontrado' USING ERRCODE='42501'; END IF;
 UPDATE public.cuidados_agenda SET visto_por=v,visto_em=now() WHERE id=_evento_id AND tenant_id IS NOT DISTINCT FROM t AND visto_em IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.portal_cuidados_agenda(date),public.portal_cuidados_criar_evento(uuid,text,date,time,text),public.portal_cuidados_ver_evento(uuid),public.validar_cuidados_agenda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cuidados_agenda(date),public.portal_cuidados_criar_evento(uuid,text,date,time,text),public.portal_cuidados_ver_evento(uuid) TO anon,authenticated,service_role;