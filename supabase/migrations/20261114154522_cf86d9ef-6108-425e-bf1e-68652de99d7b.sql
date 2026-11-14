CREATE OR REPLACE FUNCTION public.portal_cuidados_prontuario_dia(p_residente_id uuid, p_data date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ficha jsonb;
BEGIN
  -- Reutiliza a autorização por passe, módulo e residente da ficha clínica.
  v_ficha := public.portal_cuidados_ficha(p_residente_id);
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'data_registro', p.data_registro, 'horario_registro', p.horario_registro,
    'tipo_registro', p.tipo_registro, 'titulo', p.titulo, 'descricao', p.descricao,
    'observacoes', p.observacoes, 'funcionario_nome', p.funcionario_nome,
    'retifica_registro_id', p.retifica_registro_id, 'justificativa_retificacao', p.justificativa_retificacao
  ) ORDER BY p.horario_registro, p.created_at)
  FROM public.prontuario_registros p WHERE p.residente_id = p_residente_id AND p.data_registro = p_data), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.portal_cuidados_prontuario_dia(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cuidados_prontuario_dia(uuid,date) TO anon, authenticated;