-- 1) Remove regra antiga "completo por campos"
DROP TRIGGER IF EXISTS atualizar_status_ciclo_trigger ON public.prontuario_registros;

-- 2) Proteção: o dia corrente (UTC-3) nunca pode ser encerrado
CREATE OR REPLACE FUNCTION public.impedir_encerramento_dia_corrente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'encerrado' AND OLD.status IS DISTINCT FROM 'encerrado'
     AND NEW.data_ciclo >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'O prontuário do dia corrente fica aberto até 23h59 e não pode ser encerrado manualmente.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_impedir_encerramento_dia_corrente ON public.prontuario_ciclos;
CREATE TRIGGER trg_impedir_encerramento_dia_corrente BEFORE UPDATE ON public.prontuario_ciclos
FOR EACH ROW EXECUTE FUNCTION public.impedir_encerramento_dia_corrente();

-- 3) Encerramento em lote só de dias anteriores
CREATE OR REPLACE FUNCTION public.finalizar_todos_prontuarios_abertos(p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_count int; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'message','Usuário não autenticado'); END IF;
  IF NOT has_role(v_user,'admin') THEN RETURN jsonb_build_object('success',false,'message','Apenas administradores podem executar esta ação'); END IF;
  IF p_justificativa IS NULL OR trim(p_justificativa)='' THEN RETURN jsonb_build_object('success',false,'message','Justificativa é obrigatória'); END IF;
  WITH u AS (
    UPDATE prontuario_ciclos SET status='encerrado', data_encerramento=now(), updated_at=now()
    WHERE status <> 'encerrado' AND data_ciclo < v_hoje RETURNING id)
  SELECT count(*) INTO v_count FROM u;
  INSERT INTO audit_log(user_id,tabela,operacao,dados_novos) VALUES (v_user,'prontuario_ciclos','ENCERRAMENTO_LOTE',
    jsonb_build_object('quantidade_encerrados',v_count,'justificativa',p_justificativa,'data_execucao',now(),'limite','dias anteriores a '||v_hoje));
  RETURN jsonb_build_object('success',true,'message',format('%s prontuário(s) de dias anteriores encerrado(s). O dia de hoje permanece aberto.',v_count),'count',v_count);
END $$;

-- 4) Finalização individual pela gestão recusa o dia corrente
CREATE OR REPLACE FUNCTION public.finalizar_prontuario_atraso_gestor(p_ciclo_id uuid, p_gestor_id uuid, p_justificativa text)
RETURNS TABLE(success boolean, message text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status varchar; v_nome text; v_data date;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RETURN QUERY SELECT false,'Acesso negado.'; RETURN; END IF;
  IF p_justificativa IS NULL OR trim(p_justificativa)='' THEN RETURN QUERY SELECT false,'Justificativa é obrigatória.'; RETURN; END IF;
  SELECT pc.status, r.nome_completo, pc.data_ciclo INTO v_status, v_nome, v_data
  FROM prontuario_ciclos pc JOIN residentes r ON r.id=pc.residente_id WHERE pc.id=p_ciclo_id;
  IF v_status IS NULL THEN RETURN QUERY SELECT false,'Ciclo não encontrado.'; RETURN; END IF;
  IF v_status='encerrado' THEN RETURN QUERY SELECT false,'Este prontuário já foi encerrado.'; RETURN; END IF;
  IF v_data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RETURN QUERY SELECT false,'O prontuário de hoje fica aberto até 23h59 e é encerrado automaticamente.'; RETURN; END IF;
  UPDATE prontuario_ciclos SET status='encerrado', data_encerramento=now(), funcionario_encerrou=p_gestor_id, updated_at=now() WHERE id=p_ciclo_id;
  INSERT INTO audit_log(user_id,tabela,operacao,dados_novos) VALUES (auth.uid(),'prontuario_ciclos','FINALIZADO_ATRASO_GESTOR',
    jsonb_build_object('ciclo_id',p_ciclo_id,'residente_nome',v_nome,'data_ciclo',v_data,'status_anterior',v_status,'gestor_id',p_gestor_id,'justificativa',p_justificativa));
  RETURN QUERY SELECT true,'Prontuário encerrado pelo gestor.';
END $$;

-- 5) Monitoramento do dia: lançamentos por residente e turno
CREATE OR REPLACE FUNCTION public.monitorar_prontuarios_dia(p_data date DEFAULT NULL)
RETURNS TABLE(residente_id uuid, residente_nome text, quarto text, ciclo_id uuid, status text,
  lancamentos int, retificacoes int, diurno int, noturno int, ultimo_lancamento timestamptz, ultima_autora text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT COALESCE(p_data,(now() AT TIME ZONE 'America/Sao_Paulo')::date) AS dia)
  SELECT r.id, r.nome_completo, r.quarto, c.id, COALESCE(c.status,'sem_ciclo')::text,
    count(pr.id) FILTER (WHERE pr.tipo_registro IN ('lancamento','prontuario_completo'))::int,
    count(pr.id) FILTER (WHERE pr.tipo_registro='retificacao')::int,
    count(pr.id) FILTER (WHERE pr.tipo_registro<>'retificacao' AND extract(hour FROM pr.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 8 AND 19)::int,
    count(pr.id) FILTER (WHERE pr.tipo_registro<>'retificacao' AND NOT extract(hour FROM pr.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 8 AND 19)::int,
    max(pr.created_at),
    (array_agg(pr.funcionario_nome ORDER BY pr.created_at DESC) FILTER (WHERE pr.id IS NOT NULL))[1]
  FROM residentes r CROSS JOIN d
  LEFT JOIN prontuario_ciclos c ON c.residente_id=r.id AND c.data_ciclo=d.dia
  LEFT JOIN prontuario_registros pr ON pr.ciclo_id=c.id AND pr.tipo_registro IN ('lancamento','prontuario_completo','retificacao')
  WHERE r.ativo = true AND (auth.uid() IS NULL OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  GROUP BY r.id, r.nome_completo, r.quarto, c.id, c.status
  ORDER BY r.nome_completo;
$$;
GRANT EXECUTE ON FUNCTION public.monitorar_prontuarios_dia(date) TO authenticated, service_role;

-- 6) Agendamento: fecha o dia anterior e abre o novo às 00h05 (Brasília)
DO $$ BEGIN
  PERFORM cron.unschedule(j) FROM unnest(ARRAY['redefinir-prontuarios-diarios','redefinir-prontuarios-diario','gerar-prontuario-diario']) j
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname=j);
  PERFORM cron.unschedule('fechar-e-abrir-ciclos') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='fechar-e-abrir-ciclos');
  PERFORM cron.schedule('fechar-e-abrir-ciclos','5 3 * * *',
    'SELECT public.redefinir_prontuarios_com_horario(); SELECT public.criar_ciclo_prontuario_diario();');
END $$;