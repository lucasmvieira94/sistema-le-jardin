CREATE OR REPLACE FUNCTION public.calcular_modulos_funcionario(_cargo_mods text[], _tem_cargo boolean, _supervisor boolean, _extras text[], _bloq text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT m ORDER BY m), '{}') FROM unnest(
    CASE WHEN _tem_cargo THEN COALESCE(_cargo_mods,'{}')
         ELSE ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','feedback','portal_cuidados']
              || CASE WHEN _supervisor THEN ARRAY['supervisor'] ELSE '{}'::text[] END END
    || COALESCE(_extras,'{}')
  ) m WHERE NOT (m = ANY(COALESCE(_bloq,'{}')));
$$;

UPDATE public.cargos SET modulos = array_append(modulos,'portal_cuidados')
WHERE modulos && ARRAY['prontuario','medicamentos','fraldas','vacinas','meus_prontuarios']
  AND NOT ('portal_cuidados' = ANY(modulos));
UPDATE public.funcionarios SET modulos_extras = array_append(modulos_extras,'portal_cuidados')
WHERE modulos_extras && ARRAY['prontuario','medicamentos','fraldas','vacinas','meus_prontuarios']
  AND NOT ('portal_cuidados' = ANY(modulos_extras));

-- Retorna o funcionário do passe se ele tiver o módulo; senão, NULL
CREATE OR REPLACE FUNCTION public.portal_cuidados_funcionario()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id FROM public.funcionarios f
  WHERE f.id = public.portal_funcionario_atual()
    AND 'portal_cuidados' = ANY(COALESCE(public.modulos_funcionario(f.id),'{}'));
$$;

CREATE OR REPLACE FUNCTION public.portal_cuidados_residentes()
RETURNS TABLE(id uuid, nome_completo text, quarto text, data_nascimento date, condicoes_medicas text, responsavel_nome text, responsavel_telefone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_func uuid; v_tenant uuid;
BEGIN
  v_func := public.portal_cuidados_funcionario();
  IF v_func IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.funcionarios WHERE funcionarios.id = v_func;
  RETURN QUERY SELECT r.id, r.nome_completo, r.quarto, r.data_nascimento, r.condicoes_medicas, r.responsavel_nome, r.responsavel_telefone
  FROM public.residentes r
  WHERE r.ativo AND (v_tenant IS NULL OR r.tenant_id IS NULL OR r.tenant_id = v_tenant)
  ORDER BY r.nome_completo;
END $$;

CREATE OR REPLACE FUNCTION public.portal_cuidados_ficha(p_residente_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_func uuid; v_tenant uuid; r record; v jsonb;
BEGIN
  v_func := public.portal_cuidados_funcionario();
  IF v_func IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.funcionarios WHERE id = v_func;
  SELECT * INTO r FROM public.residentes WHERE id = p_residente_id AND ativo
    AND (v_tenant IS NULL OR tenant_id IS NULL OR tenant_id = v_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'Residente não encontrado' USING ERRCODE='P0002'; END IF;

  v := jsonb_build_object(
    'residente', jsonb_build_object('id', r.id, 'nome_completo', r.nome_completo, 'quarto', r.quarto,
       'data_nascimento', r.data_nascimento, 'numero_prontuario', r.numero_prontuario,
       'condicoes_medicas', r.condicoes_medicas, 'observacoes_gerais', r.observacoes_gerais,
       'responsavel_nome', r.responsavel_nome, 'responsavel_telefone', r.responsavel_telefone),
    'prontuarios', COALESCE((SELECT jsonb_agg(x ORDER BY x.data_registro DESC, x.horario_registro DESC) FROM (
        SELECT data_registro, horario_registro, tipo_registro, titulo, descricao, observacoes, funcionario_nome
        FROM public.prontuario_registros WHERE residente_id = r.id
        ORDER BY data_registro DESC, horario_registro DESC LIMIT 60) x), '[]'),
    'acolhimento', (SELECT jsonb_build_object(
        'status', f.status, 'data_preenchimento', f.data_preenchimento,
        'historico_saude', COALESCE(f.historico_saude,'{}'::jsonb) - ARRAY(SELECT k FROM jsonb_object_keys(COALESCE(f.historico_saude,'{}'::jsonb)) k WHERE k NOT IN ('alergias','cirurgias','doencas_previas','hospital_preferencia','medicacoes_uso','medico_referencia','plano_saude','vacinas_recentes')),
        'habitos_rotina', COALESCE(f.habitos_rotina,'{}'::jsonb) - ARRAY(SELECT k FROM jsonb_object_keys(COALESCE(f.habitos_rotina,'{}'::jsonb)) k WHERE k NOT IN ('alimentacao','comportamento','higiene','lazer','mobilidade','observacoes_cuidados','religiao','restricoes_alimentares','rotina_familia','sono','uso_dispositivos')))
      FROM public.fichas_acolhimento f WHERE f.residente_id = r.id AND f.status IN ('preenchida','aprovada')
      ORDER BY f.data_preenchimento DESC NULLS LAST LIMIT 1),
    'medicamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', m.nome, 'dosagem', p.dosagem, 'via', p.via_administracao,
        'horarios', p.horarios, 'frequencia', p.frequencia_tipo, 'observacoes', p.observacoes) ORDER BY m.nome)
      FROM public.prescricoes_medicamentos p JOIN public.medicamentos m ON m.id = p.medicamento_id
      WHERE p.residente_id = r.id AND p.ativo AND (p.data_fim IS NULL OR p.data_fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)), '[]'),
    'vacinas', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome_vacina, 'data', data_aplicacao, 'dose', numero_dose,
        'proxima', proxima_dose_prevista, 'reacoes', reacoes_adversas) ORDER BY data_aplicacao DESC)
      FROM public.vacinas_residentes WHERE residente_id = r.id), '[]')
  );
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.portal_cuidados_funcionario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_cuidados_residentes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_cuidados_ficha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cuidados_residentes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_cuidados_ficha(uuid) TO anon, authenticated;