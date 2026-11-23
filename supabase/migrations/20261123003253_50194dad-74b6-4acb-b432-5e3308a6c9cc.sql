DO $migration$
DECLARE src text;
BEGIN
 src:=pg_get_functiondef('public.portal_supervisao_painel()'::regprocedure);
 IF position('o.criado_por' IN src)=0 THEN RAISE EXCEPTION 'Definição inesperada do painel'; END IF;
 src:=replace(src,'o.criado_por','o.autor_funcionario_id');
 src:=replace(src,'c.inicio<=d AND (c.fim IS NULL OR c.fim>=d)', $$c.inicio<=d AND (c.fim IS NULL OR c.fim>=CASE WHEN c.frequencia='plantao' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < time '07:00' THEN d-1 ELSE d END)$$);
 src:=replace(src,'AND e.data=d)', $$AND (e.data=d OR (e.data=d-1 AND e.chave='noturno' AND c.frequencia='plantao' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < time '07:00')))$$);
 EXECUTE src;
 src:=pg_get_functiondef('public.portal_rotinas_listar(uuid,boolean)'::regprocedure);
 src:=replace(src,'c.fim >= hoje', $$c.fim >= CASE WHEN c.frequencia='plantao' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < time '07:00' THEN hoje-1 ELSE hoje END$$);
 EXECUTE src;
END $migration$;

DROP FUNCTION public.portal_rotina_executar(uuid,text,text,text);
CREATE FUNCTION public.portal_rotina_executar(_id uuid,_chave text,_valor text DEFAULT NULL,_observacao text DEFAULT NULL,_data date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid; r public.cuidados_rotinas; instante timestamp := now() AT TIME ZONE 'America/Sao_Paulo'; hoje date := instante::date; data_ocorrencia date; h time;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT tenant_id INTO t FROM public.funcionarios WHERE id=v;
 SELECT * INTO r FROM public.cuidados_rotinas WHERE id=_id AND tenant_id IS NOT DISTINCT FROM t;
 data_ocorrencia:=hoje;
 IF r.frequencia='plantao' THEN
   IF _chave IS NULL OR _chave NOT IN ('diurno','noturno') THEN RAISE EXCEPTION 'Plantão inválido'; END IF;
   IF _chave='noturno' THEN
     IF instante::time < time '07:00' THEN data_ocorrencia:=hoje-1;
     ELSIF instante::time < time '19:00' THEN RAISE EXCEPTION 'Plantão noturno ainda não iniciado'; END IF;
   ELSIF instante::time < time '07:00' THEN RAISE EXCEPTION 'Plantão diurno ainda não iniciado'; END IF;
 END IF;
 IF _data IS NOT NULL AND _data<>data_ocorrencia THEN RAISE EXCEPTION 'O plantão mudou. Atualize a lista antes de confirmar'; END IF;
 IF r.id IS NULL OR r.encerrada_em IS NOT NULL OR r.inicio > data_ocorrencia OR (r.fim IS NOT NULL AND r.fim < data_ocorrencia) THEN RAISE EXCEPTION 'Rotina não vigente neste dia/plantão'; END IF;
 IF array_length(r.dias_semana,1)>0 AND NOT (extract(dow FROM data_ocorrencia)::int=ANY(r.dias_semana)) THEN RAISE EXCEPTION 'Rotina não prevista para este dia/plantão'; END IF;
 IF r.tipo='orientacao' THEN RAISE EXCEPTION 'Orientações não exigem registro'; END IF;
 IF r.frequencia='horarios' THEN
   BEGIN h:=_chave::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Horário inválido'; END;
   IF h IS NULL OR NOT (h=ANY(r.horarios)) THEN RAISE EXCEPTION 'Horário não previsto'; END IF;
 ELSIF r.frequencia='momento' AND (_chave IS NULL OR _chave<>'dia') THEN RAISE EXCEPTION 'Ocorrência inválida'; END IF;
 IF r.tipo='afericao' AND (_valor IS NULL OR length(btrim(_valor)) NOT BETWEEN 1 AND 40) THEN RAISE EXCEPTION 'Informe o valor aferido'; END IF;
 IF length(COALESCE(_observacao,''))>1000 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
 INSERT INTO public.cuidados_rotinas_execucoes(rotina_id,data,horario_previsto,chave,feito_por,valor,observacao)
 VALUES(_id,data_ocorrencia,h,_chave,v,nullif(btrim(_valor),''),nullif(btrim(_observacao),''))
 ON CONFLICT(rotina_id,data,chave) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Esta ocorrência já foi registrada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_rotina_executar(uuid,text,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_rotina_executar(uuid,text,text,text,date) TO anon,authenticated,service_role;