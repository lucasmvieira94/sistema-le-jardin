-- Colunas novas
ALTER TABLE public.prescricoes_medicamentos
  ADD COLUMN IF NOT EXISTS estoque_medicamento_id uuid REFERENCES public.estoque_medicamentos(id),
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluida_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_exclusao text;
ALTER TABLE public.administracao_medicamentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rotina',
  ADD COLUMN IF NOT EXISTS motivo text;

-- Havia dois gatilhos descontando o estoque na mesma aplicação (desconto em dobro); mantém só o que confere saldo
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_medicamento ON public.administracao_medicamentos;

-- Helper: funcionário do portal com módulo medicamentos
CREATE OR REPLACE FUNCTION public.portal_med_funcionario()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid;
BEGIN
  v := public.portal_cuidados_funcionario();
  IF v IS NULL OR NOT ('medicamentos' = ANY(COALESCE(public.modulos_funcionario(v),'{}'))) THEN
    RAISE EXCEPTION 'Acesso não permitido' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.portal_med_residente_ok(p_residente uuid, p_tenant uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM residentes r WHERE r.id = p_residente AND r.ativo
     AND (r.tenant_id IS NULL OR p_tenant IS NULL OR r.tenant_id = p_tenant)) THEN
    RAISE EXCEPTION 'Residente não encontrado';
  END IF;
END $$;

-- Garante remédio no catálogo (por nome)
CREATE OR REPLACE FUNCTION public.portal_med_catalogo(p_nome text, p_tenant uuid, p_autor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid;
BEGIN
  IF length(trim(coalesce(p_nome,''))) < 2 OR length(p_nome) > 120 THEN RAISE EXCEPTION 'Informe o nome do medicamento'; END IF;
  SELECT id INTO v FROM medicamentos WHERE lower(trim(nome)) = lower(trim(p_nome)) AND coalesce(ativo,true)
     AND (tenant_id IS NOT DISTINCT FROM p_tenant OR tenant_id IS NULL) LIMIT 1;
  IF v IS NULL THEN
    INSERT INTO medicamentos (nome, tenant_id, observacoes) VALUES (trim(p_nome), p_tenant, 'Cadastrado no Portal de Cuidados por ' || p_autor) RETURNING id INTO v;
  END IF;
  RETURN v;
END $$;

-- 1) Entrada no estoque do residente (soma se já existir)
CREATE OR REPLACE FUNCTION public.portal_entrada_estoque_residente(p_residente_id uuid, p_nome text, p_quantidade numeric,
  p_lote text DEFAULT NULL, p_validade date DEFAULT NULL, p_observacoes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_nome text; v_t uuid; v_med uuid; v_est uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT nome_completo, tenant_id INTO v_nome, v_t FROM funcionarios WHERE id = v_f;
  PERFORM public.portal_med_residente_ok(p_residente_id, v_t);
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > 10000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  v_med := public.portal_med_catalogo(p_nome, v_t, v_nome);
  SELECT id INTO v_est FROM estoque_medicamentos WHERE residente_id = p_residente_id AND medicamento_id = v_med
     AND tipo_estoque = 'residente' AND coalesce(ativo,true) ORDER BY created_at LIMIT 1;
  IF v_est IS NULL THEN
    INSERT INTO estoque_medicamentos (medicamento_id, residente_id, tipo_estoque, quantidade_atual, lote, data_validade, tenant_id, ativo)
    VALUES (v_med, p_residente_id, 'residente', 0, nullif(trim(p_lote),''), p_validade, v_t, true) RETURNING id INTO v_est;
  ELSE
    UPDATE estoque_medicamentos SET lote = coalesce(nullif(trim(p_lote),''), lote), data_validade = coalesce(p_validade, data_validade) WHERE id = v_est;
  END IF;
  INSERT INTO entrada_medicamentos (medicamento_id, estoque_medicamento_id, quantidade, residente_id, tipo_estoque, funcionario_responsavel, observacoes, tenant_id, data_compra)
  VALUES (v_med, v_est, p_quantidade, p_residente_id, 'residente', v_f, trim(coalesce(p_observacoes,'') || ' [Portal: ' || v_nome || ']'), v_t, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  RETURN v_est;
END $$;

-- 2) Estoque do residente
CREATE OR REPLACE FUNCTION public.portal_estoque_residente(p_residente_id uuid)
RETURNS TABLE(estoque_id uuid, medicamento_id uuid, nome text, quantidade numeric, lote text, validade date, no_mapa boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t uuid;
BEGIN
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = public.portal_med_funcionario();
  PERFORM public.portal_med_residente_ok(p_residente_id, v_t);
  RETURN QUERY SELECT e.id, e.medicamento_id, m.nome, e.quantidade_atual, e.lote, e.data_validade,
    EXISTS(SELECT 1 FROM prescricoes_medicamentos p WHERE p.residente_id = e.residente_id AND p.medicamento_id = e.medicamento_id AND p.ativo)
  FROM estoque_medicamentos e JOIN medicamentos m ON m.id = e.medicamento_id
  WHERE e.residente_id = p_residente_id AND e.tipo_estoque = 'residente' AND coalesce(e.ativo,true)
  ORDER BY m.nome;
END $$;

-- 3) Cadastrar no mapa a partir do estoque
DROP FUNCTION IF EXISTS public.portal_cadastrar_medicamento(uuid,text,text,text[],text,text,date,date,text);
CREATE OR REPLACE FUNCTION public.portal_cadastrar_medicamento(p_estoque_id uuid, p_dosagem text, p_horarios text[],
  p_via text DEFAULT NULL, p_prescrito_por text DEFAULT NULL, p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL, p_observacoes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_nome text; v_t uuid; e record; v_h text[]; v_p uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT nome_completo, tenant_id INTO v_nome, v_t FROM funcionarios WHERE id = v_f;
  SELECT * INTO e FROM estoque_medicamentos WHERE id = p_estoque_id AND tipo_estoque = 'residente' AND coalesce(ativo,true);
  IF e.id IS NULL THEN RAISE EXCEPTION 'Medicamento não está no estoque do residente'; END IF;
  PERFORM public.portal_med_residente_ok(e.residente_id, v_t);
  IF e.quantidade_atual <= 0 THEN RAISE EXCEPTION 'Estoque zerado: dê entrada no estoque antes de cadastrar no mapa'; END IF;
  IF EXISTS (SELECT 1 FROM prescricoes_medicamentos WHERE residente_id = e.residente_id AND medicamento_id = e.medicamento_id AND ativo) THEN
    RAISE EXCEPTION 'Este medicamento já está no mapa do residente';
  END IF;
  IF length(trim(coalesce(p_dosagem,''))) < 1 OR length(p_dosagem) > 80 THEN RAISE EXCEPTION 'Informe a dose'; END IF;
  SELECT array_agg(DISTINCT h ORDER BY h) INTO v_h FROM unnest(p_horarios) h WHERE h ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  IF v_h IS NULL THEN RAISE EXCEPTION 'Informe ao menos um horário válido'; END IF;
  IF p_data_fim IS NOT NULL AND p_data_fim < coalesce(p_data_inicio, (now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    RAISE EXCEPTION 'Data de término anterior ao início'; END IF;
  INSERT INTO prescricoes_medicamentos (residente_id, medicamento_id, estoque_medicamento_id, dosagem, frequencia_tipo, horarios,
    via_administracao, prescrito_por, data_inicio, data_fim, observacoes, tenant_id)
  VALUES (e.residente_id, e.medicamento_id, e.id, trim(p_dosagem), 'hora_fixa_diaria', v_h, nullif(trim(p_via),''), nullif(trim(p_prescrito_por),''),
    coalesce(p_data_inicio, (now() AT TIME ZONE 'America/Sao_Paulo')::date), p_data_fim,
    trim(coalesce(p_observacoes,'') || ' [Cadastrado por ' || v_nome || ' em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ']'), v_t)
  RETURNING id INTO v_p;
  RETURN v_p;
END $$;

-- 4) Excluir do mapa (com motivo, sem apagar)
CREATE OR REPLACE FUNCTION public.portal_excluir_do_mapa(p_prescricao_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_t uuid; v_r uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = v_f;
  IF length(trim(coalesce(p_motivo,''))) < 5 OR length(p_motivo) > 500 THEN RAISE EXCEPTION 'Informe o motivo (mínimo 5 letras)'; END IF;
  SELECT residente_id INTO v_r FROM prescricoes_medicamentos WHERE id = p_prescricao_id AND ativo;
  IF v_r IS NULL THEN RAISE EXCEPTION 'Medicamento não está no mapa'; END IF;
  PERFORM public.portal_med_residente_ok(v_r, v_t);
  UPDATE prescricoes_medicamentos SET ativo = false, excluida_em = now(), excluida_por = v_f, motivo_exclusao = trim(p_motivo) WHERE id = p_prescricao_id;
END $$;

-- 5) Dar dose de rotina (não bloqueia se o estoque acabou)
CREATE OR REPLACE FUNCTION public.portal_administrar_dose(p_prescricao_id uuid, p_horario text, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_t uuid; p record; v_est uuid; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = v_f;
  SELECT * INTO p FROM prescricoes_medicamentos WHERE id = p_prescricao_id AND ativo;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Medicamento não está no mapa'; END IF;
  PERFORM public.portal_med_residente_ok(p.residente_id, v_t);
  IF p_horario !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF EXISTS (SELECT 1 FROM administracao_medicamentos WHERE residente_id = p.residente_id AND medicamento_id = p.medicamento_id
     AND data_administracao = v_hoje AND to_char(horario_administracao,'HH24:MI') = p_horario AND tipo = 'rotina') THEN
    RAISE EXCEPTION 'Esta dose já foi registrada';
  END IF;
  SELECT id INTO v_est FROM estoque_medicamentos WHERE coalesce(ativo,true) AND tipo_estoque = 'residente' AND quantidade_atual >= 1
    AND residente_id = p.residente_id AND medicamento_id = p.medicamento_id
    ORDER BY (id = p.estoque_medicamento_id) DESC, data_validade NULLS LAST LIMIT 1;
  INSERT INTO administracao_medicamentos (medicamento_id, residente_id, funcionario_id, dosagem_administrada, horario_administracao,
    data_administracao, quantidade_utilizada, via_administracao, estoque_medicamento_id, observacoes, status, tipo, tenant_id)
  VALUES (p.medicamento_id, p.residente_id, v_f, p.dosagem, p_horario::time, v_hoje, 1, p.via_administracao, v_est,
    nullif(trim(p_observacoes),''), 'administrado', 'rotina', v_t);
  RETURN jsonb_build_object('sem_estoque', v_est IS NULL);
END $$;

-- 6) Estoque de emergência
CREATE OR REPLACE FUNCTION public.portal_estoque_emergencia()
RETURNS TABLE(estoque_id uuid, medicamento_id uuid, nome text, quantidade numeric, minimo numeric, lote text, validade date, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t uuid; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = public.portal_med_funcionario();
  RETURN QUERY SELECT e.id, e.medicamento_id, m.nome, e.quantidade_atual, coalesce(e.quantidade_minima,0), e.lote, e.data_validade,
    CASE WHEN e.data_validade IS NOT NULL AND e.data_validade < v_hoje THEN 'vencido'
         WHEN e.quantidade_atual <= 0 THEN 'zerado'
         WHEN e.data_validade IS NOT NULL AND e.data_validade <= v_hoje + 30 THEN 'vence_breve'
         WHEN e.quantidade_atual <= coalesce(e.quantidade_minima,0) THEN 'baixo'
         ELSE 'ok' END
  FROM estoque_medicamentos e JOIN medicamentos m ON m.id = e.medicamento_id
  WHERE e.tipo_estoque = 'urgencia' AND coalesce(e.ativo,true) AND (e.tenant_id IS NULL OR v_t IS NULL OR e.tenant_id = v_t)
  ORDER BY m.nome, e.data_validade NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.portal_entrada_estoque_emergencia(p_nome text, p_quantidade numeric, p_lote text, p_validade date,
  p_minimo numeric DEFAULT NULL, p_observacoes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_nome text; v_t uuid; v_med uuid; v_est uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  IF NOT public.portal_eh_supervisor() THEN RAISE EXCEPTION 'Somente supervisores' USING ERRCODE='42501'; END IF;
  SELECT nome_completo, tenant_id INTO v_nome, v_t FROM funcionarios WHERE id = v_f;
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > 10000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF length(trim(coalesce(p_lote,''))) < 1 OR p_validade IS NULL THEN RAISE EXCEPTION 'Lote e validade são obrigatórios'; END IF;
  IF p_validade < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Medicamento vencido'; END IF;
  v_med := public.portal_med_catalogo(p_nome, v_t, v_nome);
  SELECT id INTO v_est FROM estoque_medicamentos WHERE tipo_estoque = 'urgencia' AND medicamento_id = v_med AND coalesce(ativo,true)
     AND lote = trim(p_lote) AND data_validade = p_validade LIMIT 1;
  IF v_est IS NULL THEN
    INSERT INTO estoque_medicamentos (medicamento_id, tipo_estoque, quantidade_atual, quantidade_minima, lote, data_validade, tenant_id, ativo)
    VALUES (v_med, 'urgencia', 0, coalesce(p_minimo,0), trim(p_lote), p_validade, v_t, true) RETURNING id INTO v_est;
  ELSIF p_minimo IS NOT NULL THEN UPDATE estoque_medicamentos SET quantidade_minima = p_minimo WHERE id = v_est;
  END IF;
  INSERT INTO entrada_medicamentos (medicamento_id, estoque_medicamento_id, quantidade, tipo_estoque, funcionario_responsavel, observacoes, tenant_id, data_compra)
  VALUES (v_med, v_est, p_quantidade, 'urgencia', v_f, trim(coalesce(p_observacoes,'') || ' [Portal: ' || v_nome || ']'), v_t, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  RETURN v_est;
END $$;

-- 7) Dose de emergência (única, fora do mapa)
CREATE OR REPLACE FUNCTION public.portal_dose_emergencia(p_residente_id uuid, p_origem text, p_medicamento_id uuid,
  p_dosagem text, p_via text, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_t uuid; v_est uuid; v_id uuid; v_agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = v_f;
  PERFORM public.portal_med_residente_ok(p_residente_id, v_t);
  IF length(trim(coalesce(p_motivo,''))) < 5 OR length(p_motivo) > 500 THEN RAISE EXCEPTION 'Informe o motivo (mínimo 5 letras)'; END IF;
  IF length(trim(coalesce(p_dosagem,''))) < 1 THEN RAISE EXCEPTION 'Informe a dose'; END IF;
  IF p_origem = 'residente' THEN
    SELECT id INTO v_est FROM estoque_medicamentos WHERE tipo_estoque = 'residente' AND residente_id = p_residente_id
      AND medicamento_id = p_medicamento_id AND coalesce(ativo,true) AND quantidade_atual >= 1
      AND (data_validade IS NULL OR data_validade >= v_agora::date) ORDER BY data_validade NULLS LAST LIMIT 1;
  ELSIF p_origem = 'emergencia' THEN
    -- usa primeiro o lote que vence antes; vencidos ficam bloqueados
    SELECT id INTO v_est FROM estoque_medicamentos WHERE tipo_estoque = 'urgencia' AND medicamento_id = p_medicamento_id
      AND coalesce(ativo,true) AND quantidade_atual >= 1 AND (data_validade IS NULL OR data_validade >= v_agora::date)
      AND (tenant_id IS NULL OR v_t IS NULL OR tenant_id = v_t) ORDER BY data_validade NULLS LAST LIMIT 1;
  ELSE RAISE EXCEPTION 'Origem inválida'; END IF;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Sem saldo válido (ou vencido) neste estoque'; END IF;
  INSERT INTO administracao_medicamentos (medicamento_id, residente_id, funcionario_id, dosagem_administrada, horario_administracao,
    data_administracao, quantidade_utilizada, via_administracao, estoque_medicamento_id, status, tipo, motivo, observacoes, tenant_id)
  VALUES (p_medicamento_id, p_residente_id, v_f, trim(p_dosagem), v_agora::time(0), v_agora::date, 1, nullif(trim(p_via),''), v_est,
    'administrado', 'emergencia', trim(p_motivo), 'Dose de emergência (' || p_origem || ')', v_t)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 8) Movimentações do estoque de emergência
CREATE OR REPLACE FUNCTION public.portal_movimentos_emergencia(p_limite int DEFAULT 100)
RETURNS TABLE(quando timestamptz, tipo text, nome text, quantidade numeric, lote text, residente text, responsavel text, motivo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t uuid;
BEGIN
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = public.portal_med_funcionario();
  IF NOT public.portal_eh_supervisor() THEN RAISE EXCEPTION 'Somente supervisores' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM (
    SELECT en.created_at, 'entrada'::text, m.nome, en.quantidade, e.lote, NULL::text, f.nome_completo, en.observacoes
    FROM entrada_medicamentos en JOIN estoque_medicamentos e ON e.id = en.estoque_medicamento_id JOIN medicamentos m ON m.id = en.medicamento_id
    LEFT JOIN funcionarios f ON f.id = en.funcionario_responsavel
    WHERE e.tipo_estoque = 'urgencia' AND (e.tenant_id IS NULL OR v_t IS NULL OR e.tenant_id = v_t)
    UNION ALL
    SELECT a.created_at, 'saida', m.nome, a.quantidade_utilizada, e.lote, r.nome_completo, f.nome_completo, a.motivo
    FROM administracao_medicamentos a JOIN estoque_medicamentos e ON e.id = a.estoque_medicamento_id JOIN medicamentos m ON m.id = a.medicamento_id
    LEFT JOIN residentes r ON r.id = a.residente_id LEFT JOIN funcionarios f ON f.id = a.funcionario_id
    WHERE e.tipo_estoque = 'urgencia' AND (e.tenant_id IS NULL OR v_t IS NULL OR e.tenant_id = v_t)
  ) x ORDER BY 1 DESC LIMIT least(coalesce(p_limite,100), 500);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['portal_med_funcionario()','portal_med_residente_ok(uuid,uuid)','portal_med_catalogo(text,uuid,text)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM public, anon, authenticated';
  END LOOP;
  FOREACH f IN ARRAY ARRAY['portal_entrada_estoque_residente(uuid,text,numeric,text,date,text)','portal_estoque_residente(uuid)',
    'portal_cadastrar_medicamento(uuid,text,text[],text,text,date,date,text)','portal_excluir_do_mapa(uuid,text)',
    'portal_administrar_dose(uuid,text,text)','portal_estoque_emergencia()','portal_entrada_estoque_emergencia(text,numeric,text,date,numeric,text)',
    'portal_dose_emergencia(uuid,text,uuid,text,text,text)','portal_movimentos_emergencia(int)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM public';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||f||' TO anon, authenticated';
  END LOOP;
END $$;