ALTER TABLE public.cuidados_agenda ADD COLUMN IF NOT EXISTS cancelado_em timestamptz, ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES public.funcionarios(id), ADD COLUMN IF NOT EXISTS motivo_cancelamento text, ADD COLUMN IF NOT EXISTS editado_por uuid REFERENCES public.funcionarios(id);

DROP FUNCTION IF EXISTS public.portal_cuidados_agenda(date);
CREATE FUNCTION public.portal_cuidados_agenda_periodo(_inicio date, _fim date, _residente_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,residente_id uuid,residente_nome text,titulo text,data_evento date,horario time,observacoes text,visto_em timestamptz,visto_por_nome text,cancelado_em timestamptz,motivo_cancelamento text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio OR _fim - _inicio > 92 THEN RAISE EXCEPTION 'Período inválido'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 RETURN QUERY SELECT a.id,a.residente_id,r.nome_completo::text,a.titulo,a.data_evento,a.horario,a.observacoes,a.visto_em,f.nome_completo::text,a.cancelado_em,a.motivo_cancelamento
 FROM public.cuidados_agenda a JOIN public.residentes r ON r.id=a.residente_id LEFT JOIN public.funcionarios f ON f.id=a.visto_por
 WHERE a.tenant_id IS NOT DISTINCT FROM t AND a.data_evento BETWEEN _inicio AND _fim AND (_residente_id IS NULL OR a.residente_id=_residente_id)
 ORDER BY a.data_evento,a.horario,a.created_at;
END $$;

CREATE FUNCTION public.portal_cuidados_agenda(_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date))
RETURNS TABLE(id uuid,residente_id uuid,residente_nome text,titulo text,data_evento date,horario time,observacoes text,visto_em timestamptz,visto_por_nome text,cancelado_em timestamptz,motivo_cancelamento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT * FROM public.portal_cuidados_agenda_periodo(_data,_data,NULL) $$;

CREATE FUNCTION public.portal_cuidados_editar_evento(_evento_id uuid,_titulo text,_data date,_horario time,_observacoes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 IF _data IS NULL OR _horario IS NULL OR _titulo IS NULL OR length(btrim(_titulo)) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Informe compromisso, data e horário válidos'; END IF;
 IF _data < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Não é possível mover para data passada'; END IF;
 UPDATE public.cuidados_agenda SET titulo=btrim(_titulo),data_evento=_data,horario=_horario,observacoes=nullif(btrim(_observacoes),''),editado_por=v,visto_em=NULL,visto_por=NULL
 WHERE id=_evento_id AND tenant_id IS NOT DISTINCT FROM t AND cancelado_em IS NULL AND visto_em IS NULL AND data_evento >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
 IF NOT FOUND THEN RAISE EXCEPTION 'Só é possível editar compromissos de hoje ou futuros ainda não vistos'; END IF;
END $$;

CREATE FUNCTION public.portal_cuidados_cancelar_evento(_evento_id uuid,_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 IF _motivo IS NULL OR length(btrim(_motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 UPDATE public.cuidados_agenda SET cancelado_em=now(),cancelado_por=v,motivo_cancelamento=btrim(_motivo)
 WHERE id=_evento_id AND tenant_id IS NOT DISTINCT FROM t AND cancelado_em IS NULL AND data_evento >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compromisso não pode ser cancelado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.portal_cuidados_ver_evento(_evento_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 UPDATE public.cuidados_agenda SET visto_por=v,visto_em=now() WHERE id=_evento_id AND tenant_id IS NOT DISTINCT FROM t AND visto_em IS NULL AND cancelado_em IS NULL AND data_evento=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
END $$;

-- Rotinas
CREATE TABLE public.cuidados_rotinas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, residente_id uuid NOT NULL REFERENCES public.residentes(id),
 titulo text NOT NULL, tipo text NOT NULL, instrucoes text, frequencia text NOT NULL, horarios time[] NOT NULL DEFAULT '{}', momento text,
 tipo_afericao text, dias_semana int[] NOT NULL DEFAULT '{}', inicio date NOT NULL, fim date,
 encerrada_em timestamptz, encerrada_por uuid REFERENCES public.funcionarios(id), motivo_encerramento text,
 criado_por uuid NOT NULL REFERENCES public.funcionarios(id), editado_por uuid REFERENCES public.funcionarios(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cuidados_rotinas TO service_role;
ALTER TABLE public.cuidados_rotinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages routines" ON public.cuidados_rotinas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX cuidados_rotinas_res_idx ON public.cuidados_rotinas(tenant_id, residente_id);

CREATE TABLE public.cuidados_rotinas_execucoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rotina_id uuid NOT NULL REFERENCES public.cuidados_rotinas(id), data date NOT NULL, horario_previsto time,
 chave text NOT NULL, feito_por uuid NOT NULL REFERENCES public.funcionarios(id), feito_em timestamptz NOT NULL DEFAULT now(), valor text, observacao text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(rotina_id, data, chave)
);
GRANT ALL ON public.cuidados_rotinas_execucoes TO service_role;
ALTER TABLE public.cuidados_rotinas_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages routine runs" ON public.cuidados_rotinas_execucoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION public.validar_cuidados_rotina() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF length(btrim(NEW.titulo)) NOT BETWEEN 1 AND 160 OR length(COALESCE(NEW.instrucoes,''))>4000 THEN RAISE EXCEPTION 'Informe título e instruções de até 4000 caracteres'; END IF;
 IF NEW.tipo NOT IN ('procedimento','afericao','orientacao') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
 IF NEW.frequencia NOT IN ('horarios','momento','plantao') THEN RAISE EXCEPTION 'Frequência inválida'; END IF;
 IF NEW.frequencia='horarios' AND COALESCE(array_length(NEW.horarios,1),0) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Informe ao menos um horário'; END IF;
 IF NEW.frequencia='momento' AND COALESCE(NEW.momento,'') NOT IN ('banho','refeicao','troca','dormir','acordar') THEN RAISE EXCEPTION 'Informe o momento'; END IF;
 IF NEW.tipo='afericao' AND COALESCE(NEW.tipo_afericao,'') NOT IN ('pressao','glicemia','temperatura','saturacao','frequencia_cardiaca','peso','outro') THEN RAISE EXCEPTION 'Informe o que será aferido'; END IF;
 IF NEW.fim IS NOT NULL AND NEW.fim < NEW.inicio THEN RAISE EXCEPTION 'Data final antes do início'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.dias_semana) d WHERE d NOT BETWEEN 0 AND 6) THEN RAISE EXCEPTION 'Dias da semana inválidos'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER cuidados_rotinas_validar BEFORE INSERT OR UPDATE ON public.cuidados_rotinas FOR EACH ROW EXECUTE FUNCTION public.validar_cuidados_rotina();

CREATE FUNCTION public.portal_rotinas_listar(_residente_id uuid DEFAULT NULL, _incluir_encerradas boolean DEFAULT false)
RETURNS TABLE(id uuid,residente_id uuid,residente_nome text,titulo text,tipo text,instrucoes text,frequencia text,horarios time[],momento text,tipo_afericao text,dias_semana int[],inicio date,fim date,encerrada_em timestamptz,motivo_encerramento text,criado_por_nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 RETURN QUERY SELECT c.id,c.residente_id,r.nome_completo::text,c.titulo,c.tipo,c.instrucoes,c.frequencia,c.horarios,c.momento,c.tipo_afericao,c.dias_semana,c.inicio,c.fim,c.encerrada_em,c.motivo_encerramento,f.nome_completo::text
 FROM public.cuidados_rotinas c JOIN public.residentes r ON r.id=c.residente_id LEFT JOIN public.funcionarios f ON f.id=c.criado_por
 WHERE c.tenant_id IS NOT DISTINCT FROM t AND (_residente_id IS NULL OR c.residente_id=_residente_id)
  AND (_incluir_encerradas OR (c.encerrada_em IS NULL AND (c.fim IS NULL OR c.fim >= hoje) AND r.ativo))
 ORDER BY r.nome_completo, c.created_at;
END $$;

CREATE FUNCTION public.portal_rotinas_execucoes(_inicio date, _fim date, _residente_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,rotina_id uuid,data date,chave text,horario_previsto time,feito_em timestamptz,feito_por_nome text,valor text,observacao text,titulo text,tipo_afericao text,residente_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 IF _fim < _inicio OR _fim - _inicio > 92 THEN RAISE EXCEPTION 'Período inválido'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 RETURN QUERY SELECT e.id,e.rotina_id,e.data,e.chave,e.horario_previsto,e.feito_em,f.nome_completo::text,e.valor,e.observacao,c.titulo,c.tipo_afericao,c.residente_id
 FROM public.cuidados_rotinas_execucoes e JOIN public.cuidados_rotinas c ON c.id=e.rotina_id LEFT JOIN public.funcionarios f ON f.id=e.feito_por
 WHERE c.tenant_id IS NOT DISTINCT FROM t AND e.data BETWEEN _inicio AND _fim AND (_residente_id IS NULL OR c.residente_id=_residente_id)
 ORDER BY e.data DESC, e.feito_em DESC;
END $$;

CREATE FUNCTION public.portal_rotina_salvar(_id uuid,_residente_id uuid,_titulo text,_tipo text,_instrucoes text,_frequencia text,_horarios time[],_momento text,_tipo_afericao text,_dias_semana int[],_inicio date,_fim date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid; novo uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 IF _inicio IS NULL THEN RAISE EXCEPTION 'Informe o início'; END IF;
 IF _id IS NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.residentes WHERE id=_residente_id AND ativo AND (tenant_id IS NOT DISTINCT FROM t OR tenant_id IS NULL)) THEN RAISE EXCEPTION 'Residente não disponível neste portal' USING ERRCODE='42501'; END IF;
  INSERT INTO public.cuidados_rotinas(tenant_id,residente_id,titulo,tipo,instrucoes,frequencia,horarios,momento,tipo_afericao,dias_semana,inicio,fim,criado_por)
  VALUES(t,_residente_id,btrim(_titulo),_tipo,nullif(btrim(_instrucoes),''),_frequencia,CASE WHEN _frequencia='horarios' THEN COALESCE(_horarios,'{}') ELSE '{}' END,CASE WHEN _frequencia='momento' THEN _momento END,CASE WHEN _tipo='afericao' THEN _tipo_afericao END,COALESCE(_dias_semana,'{}'),_inicio,_fim,v) RETURNING id INTO novo;
  RETURN novo;
 END IF;
 UPDATE public.cuidados_rotinas SET titulo=btrim(_titulo),tipo=_tipo,instrucoes=nullif(btrim(_instrucoes),''),frequencia=_frequencia,horarios=CASE WHEN _frequencia='horarios' THEN COALESCE(_horarios,'{}') ELSE '{}' END,momento=CASE WHEN _frequencia='momento' THEN _momento END,tipo_afericao=CASE WHEN _tipo='afericao' THEN _tipo_afericao END,dias_semana=COALESCE(_dias_semana,'{}'),inicio=_inicio,fim=_fim,editado_por=v
 WHERE id=_id AND tenant_id IS NOT DISTINCT FROM t AND encerrada_em IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rotina não encontrada ou encerrada'; END IF;
 RETURN _id;
END $$;

CREATE FUNCTION public.portal_rotina_encerrar(_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 IF _motivo IS NULL OR length(btrim(_motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo do encerramento'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 UPDATE public.cuidados_rotinas SET encerrada_em=now(),encerrada_por=v,motivo_encerramento=btrim(_motivo) WHERE id=_id AND tenant_id IS NOT DISTINCT FROM t AND encerrada_em IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rotina não encontrada ou já encerrada'; END IF;
END $$;

CREATE FUNCTION public.portal_rotina_executar(_id uuid,_chave text,_valor text DEFAULT NULL,_observacao text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid; r public.cuidados_rotinas; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; h time;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 SELECT * INTO r FROM public.cuidados_rotinas WHERE id=_id AND tenant_id IS NOT DISTINCT FROM t;
 IF r.id IS NULL OR r.encerrada_em IS NOT NULL OR r.inicio > hoje OR (r.fim IS NOT NULL AND r.fim < hoje) THEN RAISE EXCEPTION 'Rotina não vigente hoje'; END IF;
 IF array_length(r.dias_semana,1) > 0 AND NOT (extract(dow FROM hoje)::int = ANY(r.dias_semana)) THEN RAISE EXCEPTION 'Rotina não prevista para hoje'; END IF;
 IF r.tipo='orientacao' THEN RAISE EXCEPTION 'Orientações não exigem registro'; END IF;
 IF r.frequencia='horarios' THEN
  BEGIN h := _chave::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Horário inválido'; END;
  IF NOT (h = ANY(r.horarios)) THEN RAISE EXCEPTION 'Horário não previsto'; END IF;
 ELSIF _chave NOT IN ('diurno','noturno','dia') THEN RAISE EXCEPTION 'Ocorrência inválida'; END IF;
 IF r.tipo='afericao' AND (_valor IS NULL OR length(btrim(_valor)) NOT BETWEEN 1 AND 40) THEN RAISE EXCEPTION 'Informe o valor aferido'; END IF;
 IF length(COALESCE(_observacao,''))>1000 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
 INSERT INTO public.cuidados_rotinas_execucoes(rotina_id,data,horario_previsto,chave,feito_por,valor,observacao)
 VALUES(_id,hoje,h,_chave,v,nullif(btrim(_valor),''),nullif(btrim(_observacao),''))
 ON CONFLICT (rotina_id,data,chave) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Esta ocorrência já foi registrada'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.portal_cuidados_agenda_periodo(date,date,uuid),public.portal_cuidados_agenda(date),public.portal_cuidados_editar_evento(uuid,text,date,time,text),public.portal_cuidados_cancelar_evento(uuid,text),public.portal_rotinas_listar(uuid,boolean),public.portal_rotinas_execucoes(date,date,uuid),public.portal_rotina_salvar(uuid,uuid,text,text,text,text,time[],text,text,int[],date,date),public.portal_rotina_encerrar(uuid,text),public.portal_rotina_executar(uuid,text,text,text),public.validar_cuidados_rotina() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cuidados_agenda_periodo(date,date,uuid),public.portal_cuidados_agenda(date),public.portal_cuidados_editar_evento(uuid,text,date,time,text),public.portal_cuidados_cancelar_evento(uuid,text),public.portal_rotinas_listar(uuid,boolean),public.portal_rotinas_execucoes(date,date,uuid),public.portal_rotina_salvar(uuid,uuid,text,text,text,text,time[],text,text,int[],date,date),public.portal_rotina_encerrar(uuid,text),public.portal_rotina_executar(uuid,text,text,text) TO anon,authenticated,service_role;