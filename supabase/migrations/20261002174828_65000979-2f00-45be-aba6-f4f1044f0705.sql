-- 1) Proteção do afastamento documentado: liberada só pela exclusão auditada
CREATE OR REPLACE FUNCTION public.proteger_afastamento_documentado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.excluir_afastamento_auditado', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM public.afastamentos_anexos a WHERE a.afastamento_id = OLD.id) THEN
    RAISE EXCEPTION 'O afastamento possui documento auditado. Use a exclusão com justificativa.';
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.excluir_afastamento(p_id uuid, p_justificativa text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_af RECORD; v_snapshot jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores podem excluir afastamentos'; END IF;
  IF length(trim(COALESCE(p_justificativa, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa da exclusão'; END IF;
  SELECT * INTO v_af FROM afastamentos WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afastamento não encontrado'; END IF;
  IF v_af.tenant_id IS NOT NULL AND v_af.tenant_id IS DISTINCT FROM public.get_current_tenant_id()
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Afastamento de outra instituição';
  END IF;

  -- Cópia integral para auditoria (afastamento, anexos e acessos ao link)
  SELECT jsonb_build_object(
    'afastamento', to_jsonb(v_af),
    'anexos', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'token') FROM afastamentos_anexos x WHERE x.afastamento_id = p_id), '[]'::jsonb),
    'acessos', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM afastamentos_anexos_acessos c
                          JOIN afastamentos_anexos x ON x.id = c.anexo_id WHERE x.afastamento_id = p_id), '[]'::jsonb)
  ) INTO v_snapshot;

  INSERT INTO audit_log (user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id)
  VALUES (auth.uid(), 'afastamentos', 'EXCLUSAO_JUSTIFICADA', v_snapshot,
          jsonb_build_object('justificativa', trim(p_justificativa)), v_af.tenant_id);

  PERFORM set_config('app.excluir_afastamento_auditado', 'on', true);
  DELETE FROM afastamentos WHERE id = p_id;
  PERFORM set_config('app.excluir_afastamento_auditado', 'off', true);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.excluir_afastamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_afastamento(uuid, text) TO authenticated;

-- 2) Edição de afastamento refaz os lançamentos na apropriação
CREATE OR REPLACE FUNCTION public.limpar_registros_afastamento_antigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fim date;
BEGIN
  v_fim := CASE WHEN OLD.tipo_periodo = 'dias' THEN OLD.data_inicio + COALESCE(OLD.quantidade_dias, 1) - 1 ELSE OLD.data_inicio END;
  DELETE FROM registros_ponto
   WHERE funcionario_id = OLD.funcionario_id AND data BETWEEN OLD.data_inicio AND v_fim
     AND tipo_registro IN ('abono', 'falta');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.limpar_registros_afastamento_antigo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_afastamento_limpar_antigo ON public.afastamentos;
CREATE TRIGGER trg_afastamento_limpar_antigo BEFORE UPDATE ON public.afastamentos
  FOR EACH ROW EXECUTE FUNCTION public.limpar_registros_afastamento_antigo();
DROP TRIGGER IF EXISTS trg_afastamento_reprocessar ON public.afastamentos;
CREATE TRIGGER trg_afastamento_reprocessar AFTER UPDATE ON public.afastamentos
  FOR EACH ROW EXECUTE FUNCTION public.processar_afastamento();

-- 3) Revisão forçada da apropriação a partir dos afastamentos lançados
CREATE OR REPLACE FUNCTION public.revisar_apropriacao_horas(p_inicio date, p_fim date, p_funcionario_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_faltando int; v_reproc int := 0; v_orfaos int; v_af RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores podem revisar a apropriação'; END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio THEN RAISE EXCEPTION 'Período inválido'; END IF;
  IF p_fim - p_inicio > 400 THEN RAISE EXCEPTION 'Período máximo de revisão: 400 dias'; END IF;

  -- Dias de afastamento sem lançamento na apropriação (antes da revisão)
  SELECT count(*) INTO v_faltando
  FROM afastamentos a
  CROSS JOIN LATERAL generate_series(a.data_inicio,
       CASE WHEN a.tipo_periodo = 'dias' THEN a.data_inicio + COALESCE(a.quantidade_dias,1) - 1 ELSE a.data_inicio END, '1 day') g
  WHERE (p_funcionario_id IS NULL OR a.funcionario_id = p_funcionario_id)
    AND g::date BETWEEN p_inicio AND p_fim
    AND (a.tenant_id IS NULL OR a.tenant_id = public.get_current_tenant_id())
    AND NOT EXISTS (SELECT 1 FROM registros_ponto r WHERE r.funcionario_id = a.funcionario_id AND r.data = g::date);

  -- Reprocessa cada afastamento do período (as triggers de edição refazem os lançamentos)
  FOR v_af IN
    SELECT a.id FROM afastamentos a
    WHERE (p_funcionario_id IS NULL OR a.funcionario_id = p_funcionario_id)
      AND (a.tenant_id IS NULL OR a.tenant_id = public.get_current_tenant_id())
      AND a.data_inicio <= p_fim
      AND (CASE WHEN a.tipo_periodo = 'dias' THEN a.data_inicio + COALESCE(a.quantidade_dias,1) - 1 ELSE a.data_inicio END) >= p_inicio
  LOOP
    UPDATE afastamentos SET updated_at = now() WHERE id = v_af.id;
    v_reproc := v_reproc + 1;
  END LOOP;

  -- Abonos/faltas sem afastamento correspondente (apenas informados, não removidos)
  SELECT count(*) INTO v_orfaos FROM registros_ponto r
  WHERE r.tipo_registro IN ('abono', 'falta') AND r.data BETWEEN p_inicio AND p_fim
    AND (p_funcionario_id IS NULL OR r.funcionario_id = p_funcionario_id)
    AND NOT EXISTS (SELECT 1 FROM afastamentos a WHERE a.funcionario_id = r.funcionario_id
         AND r.data BETWEEN a.data_inicio AND (CASE WHEN a.tipo_periodo = 'dias' THEN a.data_inicio + COALESCE(a.quantidade_dias,1) - 1 ELSE a.data_inicio END));

  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (auth.uid(), 'registros_ponto', 'REVISAR_APROPRIACAO',
          jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'funcionario_id', p_funcionario_id,
                             'afastamentos_reprocessados', v_reproc, 'dias_restaurados', v_faltando, 'lancamentos_sem_afastamento', v_orfaos),
          public.get_current_tenant_id());

  RETURN jsonb_build_object('afastamentos_reprocessados', v_reproc, 'dias_restaurados', v_faltando, 'lancamentos_sem_afastamento', v_orfaos);
END $$;
REVOKE EXECUTE ON FUNCTION public.revisar_apropriacao_horas(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_apropriacao_horas(date, date, uuid) TO authenticated;