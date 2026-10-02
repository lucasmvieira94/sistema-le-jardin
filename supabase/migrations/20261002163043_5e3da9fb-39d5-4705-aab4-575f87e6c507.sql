CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.funcionarios_escalas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  escala_id integer NOT NULL REFERENCES public.escalas(id),
  tenant_id uuid,
  data_inicio date NOT NULL,
  data_fim date,
  motivo text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT periodo_valido CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT periodos_sem_sobreposicao EXCLUDE USING gist (
    funcionario_id WITH =,
    daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]') WITH &&
  )
);
CREATE INDEX idx_func_escalas_hist ON public.funcionarios_escalas_historico (funcionario_id, data_inicio);
GRANT SELECT ON public.funcionarios_escalas_historico TO authenticated;
GRANT ALL ON public.funcionarios_escalas_historico TO service_role;
ALTER TABLE public.funcionarios_escalas_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa consulta histórico de escalas" ON public.funcionarios_escalas_historico
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.has_tenant_access(tenant_id) OR public.is_super_admin());
CREATE TRIGGER trg_func_escalas_hist_updated BEFORE UPDATE ON public.funcionarios_escalas_historico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dados atuais: um período inicial por funcionário com escala
INSERT INTO public.funcionarios_escalas_historico (funcionario_id, escala_id, tenant_id, data_inicio, motivo)
SELECT f.id, f.escala_id, f.tenant_id, COALESCE(f.data_inicio_vigencia, f.data_admissao, f.created_at::date),
       'Período inicial (migração do histórico de escalas)'
FROM public.funcionarios f WHERE f.escala_id IS NOT NULL;

-- Escala vigente em uma data (sem histórico: usa o cadastro atual)
CREATE OR REPLACE FUNCTION public.escala_vigente_em(p_funcionario_id uuid, p_data date)
RETURNS TABLE(escala_id integer, inicio_periodo date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM funcionarios_escalas_historico h WHERE h.funcionario_id = p_funcionario_id) THEN
    RETURN QUERY SELECT h.escala_id, h.data_inicio FROM funcionarios_escalas_historico h
      WHERE h.funcionario_id = p_funcionario_id AND p_data >= h.data_inicio
        AND (h.data_fim IS NULL OR p_data <= h.data_fim)
      LIMIT 1;
  ELSE
    RETURN QUERY SELECT f.escala_id, COALESCE(f.data_inicio_vigencia, f.data_admissao)
      FROM funcionarios f WHERE f.id = p_funcionario_id AND f.escala_id IS NOT NULL;
  END IF;
END $$;

-- Mantém funcionarios.escala_id / data_inicio_vigencia como cache da escala de hoje
CREATE OR REPLACE FUNCTION public.sincronizar_cache_escala(p_funcionario_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_esc integer; v_ini date; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT h.escala_id, h.data_inicio INTO v_esc, v_ini FROM funcionarios_escalas_historico h
   WHERE h.funcionario_id = p_funcionario_id AND v_hoje >= h.data_inicio AND (h.data_fim IS NULL OR v_hoje <= h.data_fim) LIMIT 1;
  IF v_esc IS NULL THEN
    -- antes do primeiro período ou troca futura: mantém o mais recente já iniciado ou o primeiro futuro
    SELECT h.escala_id, h.data_inicio INTO v_esc, v_ini FROM funcionarios_escalas_historico h
     WHERE h.funcionario_id = p_funcionario_id ORDER BY (h.data_inicio > v_hoje), abs(h.data_inicio - v_hoje) LIMIT 1;
  END IF;
  IF v_esc IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.sync_escala', 'on', true);
  UPDATE funcionarios SET escala_id = v_esc, data_inicio_vigencia = v_ini WHERE id = p_funcionario_id;
  PERFORM set_config('app.sync_escala', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.exigir_admin_escala()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar escalas';
  END IF;
END $$;

-- Alterar escala a partir de uma data (encerra o período anterior)
CREATE OR REPLACE FUNCTION public.alterar_escala_funcionario(p_funcionario_id uuid, p_escala_id integer, p_data_inicio date, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tenant uuid; v_ant RECORD;
BEGIN
  PERFORM public.exigir_admin_escala();
  IF p_data_inicio IS NULL OR p_escala_id IS NULL THEN RAISE EXCEPTION 'Informe a escala e a data de início'; END IF;
  SELECT tenant_id INTO v_tenant FROM funcionarios WHERE id = p_funcionario_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM funcionarios_escalas_historico WHERE funcionario_id = p_funcionario_id AND data_inicio >= p_data_inicio) THEN
    RAISE EXCEPTION 'Já existe um período de escala começando nesta data ou depois. Corrija ou exclua esse período no histórico.';
  END IF;
  SELECT * INTO v_ant FROM funcionarios_escalas_historico
   WHERE funcionario_id = p_funcionario_id AND data_inicio < p_data_inicio AND (data_fim IS NULL OR data_fim >= p_data_inicio) LIMIT 1;
  IF FOUND THEN
    IF v_ant.escala_id = p_escala_id THEN RAISE EXCEPTION 'O funcionário já está nesta escala nesta data'; END IF;
    UPDATE funcionarios_escalas_historico SET data_fim = p_data_inicio - 1 WHERE id = v_ant.id;
  END IF;
  INSERT INTO funcionarios_escalas_historico (funcionario_id, escala_id, tenant_id, data_inicio, motivo, criado_por)
  VALUES (p_funcionario_id, p_escala_id, v_tenant, p_data_inicio, NULLIF(trim(p_motivo), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.sincronizar_cache_escala(p_funcionario_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id)
  VALUES (auth.uid(), 'funcionarios_escalas_historico', 'ALTERAR_ESCALA', to_jsonb(v_ant),
          jsonb_build_object('id', v_id, 'escala_id', p_escala_id, 'data_inicio', p_data_inicio, 'motivo', p_motivo), v_tenant);
  RETURN v_id;
END $$;

-- Lançar período antigo (reconstrução do passado)
CREATE OR REPLACE FUNCTION public.lancar_periodo_escala(p_funcionario_id uuid, p_escala_id integer, p_data_inicio date, p_data_fim date, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tenant uuid;
BEGIN
  PERFORM public.exigir_admin_escala();
  IF p_data_fim IS NULL THEN RAISE EXCEPTION 'Informe a data de fim do período antigo'; END IF;
  IF coalesce(trim(p_motivo), '') = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT tenant_id INTO v_tenant FROM funcionarios WHERE id = p_funcionario_id;
  BEGIN
    INSERT INTO funcionarios_escalas_historico (funcionario_id, escala_id, tenant_id, data_inicio, data_fim, motivo, criado_por)
    VALUES (p_funcionario_id, p_escala_id, v_tenant, p_data_inicio, p_data_fim, trim(p_motivo), auth.uid()) RETURNING id INTO v_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Este período se sobrepõe a outro período de escala do funcionário';
  END;
  PERFORM public.sincronizar_cache_escala(p_funcionario_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (auth.uid(), 'funcionarios_escalas_historico', 'LANCAR_PERIODO_ESCALA',
          jsonb_build_object('id', v_id, 'escala_id', p_escala_id, 'data_inicio', p_data_inicio, 'data_fim', p_data_fim, 'motivo', p_motivo), v_tenant);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.corrigir_periodo_escala(p_id uuid, p_escala_id integer, p_data_inicio date, p_data_fim date, p_justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ant RECORD;
BEGIN
  PERFORM public.exigir_admin_escala();
  IF coalesce(trim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_ant FROM funcionarios_escalas_historico WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Período não encontrado'; END IF;
  BEGIN
    UPDATE funcionarios_escalas_historico SET escala_id = p_escala_id, data_inicio = p_data_inicio, data_fim = p_data_fim WHERE id = p_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'O período corrigido se sobrepõe a outro período de escala';
  END;
  PERFORM public.sincronizar_cache_escala(v_ant.funcionario_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id)
  VALUES (auth.uid(), 'funcionarios_escalas_historico', 'CORRIGIR_PERIODO_ESCALA', to_jsonb(v_ant),
          jsonb_build_object('escala_id', p_escala_id, 'data_inicio', p_data_inicio, 'data_fim', p_data_fim, 'justificativa', p_justificativa), v_ant.tenant_id);
END $$;

CREATE OR REPLACE FUNCTION public.excluir_periodo_escala(p_id uuid, p_justificativa text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ant RECORD;
BEGIN
  PERFORM public.exigir_admin_escala();
  IF coalesce(trim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_ant FROM funcionarios_escalas_historico WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Período não encontrado'; END IF;
  IF (SELECT count(*) FROM funcionarios_escalas_historico WHERE funcionario_id = v_ant.funcionario_id) = 1 THEN
    RAISE EXCEPTION 'Não é possível excluir o único período de escala do funcionário';
  END IF;
  DELETE FROM funcionarios_escalas_historico WHERE id = p_id;
  -- Se era o período vigente, reabre o anterior
  IF v_ant.data_fim IS NULL THEN
    UPDATE funcionarios_escalas_historico SET data_fim = NULL
     WHERE id = (SELECT id FROM funcionarios_escalas_historico WHERE funcionario_id = v_ant.funcionario_id ORDER BY data_inicio DESC LIMIT 1);
  END IF;
  PERFORM public.sincronizar_cache_escala(v_ant.funcionario_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id)
  VALUES (auth.uid(), 'funcionarios_escalas_historico', 'EXCLUIR_PERIODO_ESCALA', to_jsonb(v_ant),
          jsonb_build_object('justificativa', p_justificativa), v_ant.tenant_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.sincronizar_cache_escala(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.alterar_escala_funcionario(uuid,integer,date,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lancar_periodo_escala(uuid,integer,date,date,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.corrigir_periodo_escala(uuid,integer,date,date,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.excluir_periodo_escala(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.exigir_admin_escala() FROM PUBLIC, anon;

-- Rede de segurança: alterações diretas em funcionarios.escala_id entram no histórico
CREATE OR REPLACE FUNCTION public.registrar_escala_no_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini date; v_ultimo date; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF current_setting('app.sync_escala', true) = 'on' OR NEW.escala_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.escala_id IS NOT DISTINCT FROM OLD.escala_id THEN RETURN NEW; END IF;
  v_ini := COALESCE(NEW.data_inicio_vigencia, CASE WHEN TG_OP = 'INSERT' THEN NEW.data_admissao END, v_hoje);
  SELECT max(data_inicio) INTO v_ultimo FROM funcionarios_escalas_historico WHERE funcionario_id = NEW.id;
  IF v_ultimo IS NOT NULL AND v_ini <= v_ultimo THEN v_ini := GREATEST(v_ultimo + 1, v_hoje); END IF;
  UPDATE funcionarios_escalas_historico SET data_fim = v_ini - 1
   WHERE funcionario_id = NEW.id AND data_inicio < v_ini AND (data_fim IS NULL OR data_fim >= v_ini);
  INSERT INTO funcionarios_escalas_historico (funcionario_id, escala_id, tenant_id, data_inicio, motivo, criado_por)
  VALUES (NEW.id, NEW.escala_id, NEW.tenant_id, v_ini,
          CASE WHEN TG_OP = 'INSERT' THEN 'Escala do cadastro' ELSE 'Alteração pelo cadastro do funcionário' END, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER trg_registrar_escala_historico AFTER INSERT OR UPDATE OF escala_id ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.registrar_escala_no_historico();

-- ===== Leitura por data =====
CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(p_funcionario_id uuid, p_data_inicio date, p_data_fim date)
RETURNS TABLE(data date, entrada time, intervalo_inicio time, intervalo_fim time, saida time, deve_trabalhar boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_func RECORD; v_data_atual date; v_vig RECORD; v_ciclo int; v_total int; v_trab boolean;
  v_ii time; v_if time; v_algum boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = p_funcionario_id) THEN
    RAISE EXCEPTION 'Funcionário ou escala não encontrados';
  END IF;
  v_data_atual := p_data_inicio;
  WHILE v_data_atual <= p_data_fim LOOP
    SELECT * INTO v_vig FROM public.escala_vigente_em(p_funcionario_id, v_data_atual);
    v_func := NULL;
    IF v_vig.escala_id IS NOT NULL THEN
      SELECT e.nome AS escala_nome, e.entrada AS escala_entrada, e.saida AS escala_saida,
             e.intervalo_inicio AS escala_intervalo_inicio, e.intervalo_fim AS escala_intervalo_fim,
             COALESCE(e.jornada_trabalho, '') AS jornada, COALESCE(e.intervalo_pre_assinalado, false) AS pre
      INTO v_func FROM public.escalas e WHERE e.id = v_vig.escala_id;
    END IF;

    IF v_func IS NULL THEN
      -- dia sem escala registrada: não é dia de trabalho nem gera falta
      RETURN QUERY SELECT v_data_atual, NULL::time, NULL::time, NULL::time, NULL::time, FALSE;
    ELSE
      v_algum := true;
      v_total := CASE WHEN v_func.jornada ILIKE '%12x36%' THEN 2 WHEN v_func.jornada ILIKE '%4x2%' THEN 6 ELSE 7 END;
      v_ciclo := ((v_data_atual - COALESCE(v_vig.inicio_periodo, v_data_atual)) % v_total) + 1;
      IF v_func.jornada ILIKE '%12x36%' OR v_func.escala_nome ILIKE '%12%36%' THEN v_trab := v_ciclo % 2 = 1;
      ELSIF v_func.jornada ILIKE '%6x1%' OR v_func.escala_nome ILIKE '%6x1%' THEN v_trab := v_ciclo <= 6;
      ELSIF v_func.jornada ILIKE '%5x2%' OR v_func.escala_nome ILIKE '%5x2%' THEN v_trab := v_ciclo <= 5;
      ELSIF v_func.jornada ILIKE '%4x2%' OR v_func.escala_nome ILIKE '%4x2%' THEN v_trab := v_ciclo <= 4;
      ELSE
        v_trab := (
          (EXTRACT(DOW FROM v_data_atual) = 1 AND v_func.jornada ILIKE '%segunda%') OR
          (EXTRACT(DOW FROM v_data_atual) = 2 AND v_func.jornada ILIKE '%terca%') OR
          (EXTRACT(DOW FROM v_data_atual) = 3 AND v_func.jornada ILIKE '%quarta%') OR
          (EXTRACT(DOW FROM v_data_atual) = 4 AND v_func.jornada ILIKE '%quinta%') OR
          (EXTRACT(DOW FROM v_data_atual) = 5 AND v_func.jornada ILIKE '%sexta%') OR
          (EXTRACT(DOW FROM v_data_atual) = 6 AND v_func.jornada ILIKE '%sabado%') OR
          (EXTRACT(DOW FROM v_data_atual) = 0 AND v_func.jornada ILIKE '%domingo%') OR
          (v_func.jornada ILIKE '%segsex%' AND EXTRACT(DOW FROM v_data_atual) BETWEEN 1 AND 5)
        );
      END IF;
      IF v_trab THEN
        v_ii := NULL; v_if := NULL;
        IF v_func.pre THEN
          v_ii := v_func.escala_intervalo_inicio; v_if := v_func.escala_intervalo_fim;
          IF v_ii IS NULL OR v_if IS NULL THEN
            SELECT ia.intervalo_inicio, ia.intervalo_fim INTO v_ii, v_if
              FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) ia;
          END IF;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada, v_ii, v_if, v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::time, NULL::time, NULL::time, NULL::time, FALSE;
      END IF;
    END IF;
    v_data_atual := v_data_atual + 1;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(p_funcionario_id uuid, p_data date, p_entrada time, p_saida time)
RETURNS TABLE(intervalo_inicio time, intervalo_fim time)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  e_ii time; e_if time; e_pre boolean; dur interval; meio timestamp; ini timestamp; fim timestamp; ent timestamp; sai timestamp;
BEGIN
  SELECT e.intervalo_inicio, e.intervalo_fim, COALESCE(e.intervalo_pre_assinalado, false)
  INTO e_ii, e_if, e_pre
  FROM public.escala_vigente_em(p_funcionario_id, p_data) v JOIN public.escalas e ON e.id = v.escala_id;
  IF NOT COALESCE(e_pre, false) THEN RETURN QUERY SELECT NULL::time, NULL::time; RETURN; END IF;
  IF e_ii IS NOT NULL AND e_if IS NOT NULL THEN RETURN QUERY SELECT e_ii, e_if; RETURN; END IF;
  ent := '2000-01-01'::date + p_entrada; sai := '2000-01-01'::date + p_saida;
  IF p_saida < p_entrada THEN sai := sai + interval '1 day'; END IF;
  dur := sai - ent;
  IF dur > interval '6 hours' THEN meio := ent + dur / 2; ini := meio - interval '30 minutes'; fim := meio + interval '30 minutes';
  ELSIF dur > interval '4 hours' THEN meio := ent + dur / 2; ini := meio - interval '7.5 minutes'; fim := meio + interval '7.5 minutes';
  ELSE RETURN QUERY SELECT NULL::time, NULL::time; RETURN; END IF;
  RETURN QUERY SELECT ini::time, fim::time;
END $function$;

CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  escala_entrada time; escala_saida time; escala_intervalo_inicio time; escala_intervalo_fim time;
  escala_intervalo_minutos integer; escala_pre_assinalado boolean; padrao_empresa integer; minutos_intervalo integer;
  jornada_duracao interval; hora_inicio_intervalo time; hora_fim_intervalo time;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.saida IS NULL AND NEW.saida IS NOT NULL THEN
    IF NEW.intervalo_inicio IS NULL AND NEW.intervalo_fim IS NULL THEN
      SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim, e.intervalo_minutos, COALESCE(e.intervalo_pre_assinalado, false)
      INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim, escala_intervalo_minutos, escala_pre_assinalado
      FROM public.escala_vigente_em(NEW.funcionario_id, NEW.data) v JOIN public.escalas e ON e.id = v.escala_id;
      IF NOT COALESCE(escala_pre_assinalado, false) THEN RETURN NEW; END IF;
      IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
        NEW.intervalo_inicio := escala_intervalo_inicio; NEW.intervalo_fim := escala_intervalo_fim;
      ELSE
        SELECT c.intervalo_minimo_minutos INTO padrao_empresa FROM public.configuracoes_empresa c LIMIT 1;
        minutos_intervalo := COALESCE(NULLIF(escala_intervalo_minutos, 0), padrao_empresa, 60);
        IF escala_entrada IS NOT NULL AND escala_saida IS NOT NULL AND NEW.entrada IS NOT NULL THEN
          jornada_duracao := escala_saida - escala_entrada;
          IF jornada_duracao > interval '6 hours' THEN
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2 - make_interval(mins => minutos_intervalo / 2);
            hora_fim_intervalo := hora_inicio_intervalo + make_interval(mins => minutos_intervalo);
          ELSIF jornada_duracao > interval '4 hours' THEN
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2 - interval '7.5 minutes';
            hora_fim_intervalo := hora_inicio_intervalo + interval '15 minutes';
          END IF;
          IF hora_inicio_intervalo IS NOT NULL AND hora_fim_intervalo IS NOT NULL THEN
            NEW.intervalo_inicio := hora_inicio_intervalo; NEW.intervalo_fim := hora_fim_intervalo;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
RETURNS TABLE(funcionario_nome text, funcionario_cpf character varying, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time, funcionario_escala_saida time, dia integer, data date, entrada time, intervalo_inicio time, intervalo_fim time, saida time, horas_trabalhadas text, horas_extras_diurnas text, horas_extras_noturnas text, faltas boolean, abonos boolean, observacoes text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  dias_no_mes int; dia_atual int; data_atual date; fr RECORD; er RECORD; vig RECORD; registro_record RECORD;
  afastamento_exists boolean; calc_horas_trabalhadas text; calc_horas_extras_diurnas text; calc_horas_noturnas text;
  calc_faltas boolean; calc_abonos boolean; dia_semana int; deve_trabalhar boolean; jornada text; data_vigencia date;
  eff_intervalo_inicio time; eff_intervalo_fim time; pausas_total interval; bruto interval; liquido interval;
  excedente interval; extras_int interval; tem_escala boolean;
BEGIN
  SELECT f.nome_completo, f.cpf, f.funcao, f.data_admissao, f.data_desligamento INTO fr
  FROM funcionarios f WHERE f.id = p_funcionario_id;
  IF NOT FOUND THEN RETURN; END IF;
  dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_ano, p_mes, 1)) + interval '1 month' - interval '1 day'));

  FOR dia_atual IN 1..dias_no_mes LOOP
    data_atual := make_date(p_ano, p_mes, dia_atual);
    calc_horas_trabalhadas := '00:00:00'; calc_horas_extras_diurnas := '00:00:00'; calc_horas_noturnas := '00:00:00';
    calc_faltas := false; calc_abonos := false; excedente := interval '0';
    dia_semana := EXTRACT(DOW FROM data_atual);
    deve_trabalhar := false;

    -- Escala vigente NESTE dia
    SELECT * INTO vig FROM escala_vigente_em(p_funcionario_id, data_atual);
    er := NULL;
    IF vig.escala_id IS NOT NULL THEN
      SELECT e.nome AS escala_nome, e.entrada AS escala_entrada, e.saida AS escala_saida,
             e.intervalo_inicio AS escala_intervalo_inicio, e.intervalo_fim AS escala_intervalo_fim, e.jornada_trabalho,
             COALESCE(e.intervalo_pre_assinalado, false) AS intervalo_pre_assinalado, COALESCE(e.intervalo_minutos, 60) AS intervalo_minutos
      INTO er FROM escalas e WHERE e.id = vig.escala_id;
    END IF;
    tem_escala := er IS NOT NULL;

    IF tem_escala THEN
      jornada := er.jornada_trabalho;
      data_vigencia := COALESCE(vig.inicio_periodo, data_atual);
      IF jornada = '40h_8h_segsex' THEN deve_trabalhar := dia_semana BETWEEN 1 AND 5;
      ELSIF jornada = '44h_8h_segsab' OR jornada = '44h_8h_segsex_4h_sab' THEN deve_trabalhar := dia_semana BETWEEN 1 AND 6;
      ELSIF jornada = '12x36' THEN deve_trabalhar := (data_atual - data_vigencia) % 2 = 0;
      ELSIF jornada = '24x72' THEN deve_trabalhar := (data_atual - data_vigencia) % 4 = 0;
      ELSIF jornada = '24x48' THEN deve_trabalhar := (data_atual - data_vigencia) % 3 = 0;
      ELSIF jornada = '6x1' OR jornada = '36h_6h_seg_sab' THEN deve_trabalhar := (data_atual - data_vigencia) % 7 != 6;
      ELSE deve_trabalhar := dia_semana BETWEEN 1 AND 5; END IF;
    END IF;
    IF fr.data_desligamento IS NOT NULL AND data_atual > fr.data_desligamento THEN deve_trabalhar := false; END IF;

    registro_record := NULL;
    SELECT rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida, rp.observacoes, rp.intervalos_pausas
    INTO registro_record FROM registros_ponto rp WHERE rp.funcionario_id = p_funcionario_id AND rp.data = data_atual LIMIT 1;

    SELECT EXISTS(SELECT 1 FROM afastamentos a WHERE a.funcionario_id = p_funcionario_id
      AND data_atual BETWEEN a.data_inicio AND COALESCE(a.data_fim, a.data_inicio)) INTO afastamento_exists;

    eff_intervalo_inicio := registro_record.intervalo_inicio;
    eff_intervalo_fim := registro_record.intervalo_fim;
    IF tem_escala AND er.intervalo_pre_assinalado THEN
      eff_intervalo_inicio := er.escala_intervalo_inicio; eff_intervalo_fim := er.escala_intervalo_fim;
    END IF;

    IF registro_record.observacoes ILIKE '%abono%' THEN calc_abonos := true;
    ELSIF registro_record.observacoes ILIKE '%falta%' THEN calc_faltas := true;
    ELSIF afastamento_exists THEN calc_abonos := true;
    ELSIF registro_record.entrada IS NOT NULL AND registro_record.saida IS NOT NULL THEN
      BEGIN
        IF registro_record.saida < registro_record.entrada THEN
          bruto := ('2000-01-02'::date + registro_record.saida) - ('2000-01-01'::date + registro_record.entrada);
        ELSE bruto := registro_record.saida - registro_record.entrada; END IF;
        IF tem_escala AND er.intervalo_pre_assinalado AND er.escala_intervalo_inicio IS NOT NULL AND er.escala_intervalo_fim IS NOT NULL THEN
          IF er.escala_intervalo_fim < er.escala_intervalo_inicio THEN
            liquido := bruto - (('2000-01-02'::date + er.escala_intervalo_fim) - ('2000-01-01'::date + er.escala_intervalo_inicio));
          ELSE liquido := bruto - (er.escala_intervalo_fim - er.escala_intervalo_inicio); END IF;
        ELSIF registro_record.intervalos_pausas IS NOT NULL AND jsonb_typeof(registro_record.intervalos_pausas) = 'array'
              AND jsonb_array_length(registro_record.intervalos_pausas) > 0 THEN
          pausas_total := public.somar_pausas(registro_record.intervalos_pausas);
          liquido := bruto - pausas_total;
          IF tem_escala AND pausas_total > make_interval(mins => er.intervalo_minutos) THEN
            excedente := pausas_total - make_interval(mins => er.intervalo_minutos);
          END IF;
        ELSE
          liquido := public.calcular_horas_trabalhadas(registro_record.entrada, registro_record.saida, registro_record.intervalo_inicio, registro_record.intervalo_fim);
        END IF;
        IF liquido < interval '0' THEN liquido := interval '0'; END IF;
        calc_horas_trabalhadas := liquido::text;
      EXCEPTION WHEN OTHERS THEN calc_horas_trabalhadas := '00:00:00'; END;
      IF tem_escala THEN
        BEGIN
          SELECT COALESCE(public.calcular_horas_extras_diurnas(registro_record.entrada, eff_intervalo_inicio, eff_intervalo_fim,
                 registro_record.saida, er.escala_entrada, er.escala_saida), interval '0') INTO extras_int;
          extras_int := extras_int - excedente;
          IF extras_int < interval '0' THEN extras_int := interval '0'; END IF;
          calc_horas_extras_diurnas := extras_int::text;
        EXCEPTION WHEN OTHERS THEN calc_horas_extras_diurnas := '00:00:00'; END;
      END IF;
      BEGIN
        SELECT COALESCE(public.calcular_horas_noturnas(registro_record.entrada, registro_record.saida, eff_intervalo_inicio, eff_intervalo_fim)::text, '00:00:00')
        INTO calc_horas_noturnas;
      EXCEPTION WHEN OTHERS THEN calc_horas_noturnas := '00:00:00'; END;
    ELSIF deve_trabalhar AND registro_record.entrada IS NULL AND registro_record.saida IS NULL THEN
      calc_faltas := true;
    END IF;

    funcionario_nome := fr.nome_completo; funcionario_cpf := fr.cpf; funcionario_funcao := fr.funcao;
    funcionario_escala_nome := CASE WHEN tem_escala THEN er.escala_nome ELSE 'Sem escala registrada' END;
    funcionario_escala_entrada := CASE WHEN tem_escala THEN er.escala_entrada END;
    funcionario_escala_saida := CASE WHEN tem_escala THEN er.escala_saida END;
    dia := dia_atual; data := data_atual;
    entrada := registro_record.entrada; intervalo_inicio := eff_intervalo_inicio; intervalo_fim := eff_intervalo_fim;
    saida := registro_record.saida;
    horas_trabalhadas := calc_horas_trabalhadas; horas_extras_diurnas := calc_horas_extras_diurnas;
    horas_extras_noturnas := calc_horas_noturnas; faltas := calc_faltas; abonos := calc_abonos;
    observacoes := registro_record.observacoes;
    RETURN NEXT;
  END LOOP;
END $function$;