CREATE OR REPLACE FUNCTION public.distancia_descriptor(a jsonb, b jsonb)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s numeric := 0; i int; n int;
BEGIN
  IF a IS NULL OR b IS NULL OR jsonb_typeof(a) <> 'array' OR jsonb_typeof(b) <> 'array' THEN RETURN NULL; END IF;
  n := jsonb_array_length(a);
  IF n <> 128 OR jsonb_array_length(b) <> 128 THEN RETURN NULL; END IF;
  FOR i IN 0..n-1 LOOP
    s := s + power((a->>i)::numeric - (b->>i)::numeric, 2);
  END LOOP;
  RETURN sqrt(s);
END $$;
REVOKE EXECUTE ON FUNCTION public.distancia_descriptor(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.biometria_status_funcionario(p_funcionario_id uuid)
RETURNS TABLE(cadastrada boolean, cadastrada_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.biometria_facial IS NOT NULL, f.biometria_cadastrada_em
  FROM funcionarios f WHERE f.id = p_funcionario_id AND f.ativo
$$;

CREATE OR REPLACE FUNCTION public.autocadastrar_biometria_funcionario(p_funcionario_id uuid, p_amostras jsonb, p_user_agent text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; n int; i int; j int; d numeric; media jsonb; k int; soma numeric; v_now timestamptz := now();
BEGIN
  SELECT id, tenant_id, biometria_facial INTO v FROM funcionarios WHERE id = p_funcionario_id AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado ou inativo'; END IF;
  IF v.biometria_facial IS NOT NULL THEN
    RAISE EXCEPTION 'Biometria já cadastrada. Para trocar, procure o gestor.';
  END IF;
  IF jsonb_typeof(p_amostras) <> 'array' THEN RAISE EXCEPTION 'Amostras inválidas'; END IF;
  n := jsonb_array_length(p_amostras);
  IF n < 3 OR n > 5 THEN RAISE EXCEPTION 'Envie de 3 a 5 capturas do rosto'; END IF;
  FOR i IN 0..n-1 LOOP
    IF jsonb_typeof(p_amostras->i) <> 'array' OR jsonb_array_length(p_amostras->i) <> 128 THEN
      RAISE EXCEPTION 'Captura % inválida', i+1;
    END IF;
    FOR j IN i+1..n-1 LOOP
      d := distancia_descriptor(p_amostras->i, p_amostras->j);
      IF d IS NULL OR d > 0.5 THEN
        RAISE EXCEPTION 'As capturas não parecem da mesma pessoa. Refaça com o rosto bem iluminado.';
      END IF;
    END LOOP;
  END LOOP;
  media := '[]'::jsonb;
  FOR k IN 0..127 LOOP
    soma := 0;
    FOR i IN 0..n-1 LOOP soma := soma + (p_amostras->i->>k)::numeric; END LOOP;
    media := media || to_jsonb(soma / n);
  END LOOP;
  UPDATE funcionarios SET biometria_facial = media, biometria_cadastrada_em = v_now WHERE id = p_funcionario_id;
  INSERT INTO biometria_validacoes_log (funcionario_id, contexto, sucesso, user_agent, tenant_id)
  VALUES (p_funcionario_id, 'autocadastro', true, left(p_user_agent,500), v.tenant_id);
  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (NULL, 'funcionarios', 'AUTOCADASTRO_BIOMETRIA',
    jsonb_build_object('funcionario_id', p_funcionario_id, 'amostras', n, 'cadastrada_em', v_now), v.tenant_id);
  RETURN v_now;
END $$;

DROP FUNCTION IF EXISTS public.assinar_documento_interno(uuid, text, uuid, text, boolean, text, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.assinar_documento_interno(
  p_funcionario_id uuid, p_tipo_documento text, p_referencia_id uuid, p_hash_documento text,
  p_aceite boolean, p_motivo_recusa text, p_descriptor jsonb, p_user_agent text)
RETURNS TABLE(id uuid, hash_assinatura text, assinado_em timestamptz, distancia numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_func RECORD; v_titulo text; v_ok boolean := false; v_hash text; v_now timestamptz := now();
  v_id uuid; v_ip text; v_doc_hash text; v_dist numeric; c_threshold constant numeric := 0.55;
BEGIN
  SELECT fu.id, fu.tenant_id, fu.biometria_facial INTO v_func FROM funcionarios fu WHERE fu.id = p_funcionario_id AND fu.ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado ou inativo'; END IF;
  IF p_hash_documento IS NULL OR length(p_hash_documento) <> 64 THEN RAISE EXCEPTION 'Hash do documento inválido'; END IF;

  BEGIN
    v_ip := split_part(coalesce((current_setting('request.headers', true)::jsonb)->>'x-forwarded-for',''), ',', 1);
  EXCEPTION WHEN others THEN v_ip := NULL; END;

  IF p_aceite THEN
    IF v_func.biometria_facial IS NULL THEN RAISE EXCEPTION 'Cadastre sua biometria facial antes de assinar'; END IF;
    v_dist := distancia_descriptor(p_descriptor, v_func.biometria_facial);
    INSERT INTO biometria_validacoes_log (funcionario_id, contexto, sucesso, distancia, threshold, user_agent, ip_address, tenant_id)
    VALUES (p_funcionario_id, 'assinatura_documento', v_dist IS NOT NULL AND v_dist < c_threshold, v_dist, c_threshold,
      left(p_user_agent,500), nullif(trim(v_ip),''), v_func.tenant_id);
    IF v_dist IS NULL OR v_dist >= c_threshold THEN
      RAISE EXCEPTION 'Rosto não reconhecido. Tente novamente com boa iluminação.';
    END IF;
  ELSIF coalesce(length(trim(p_motivo_recusa)),0) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa (mínimo 5 caracteres)';
  END IF;

  IF p_tipo_documento = 'advertencia' THEN
    SELECT true, 'Advertência/suspensão de ' || to_char(a.data_ocorrencia::date,'DD/MM/YYYY') INTO v_ok, v_titulo
      FROM advertencias_suspensoes a WHERE a.id = p_referencia_id AND a.funcionario_id = p_funcionario_id;
  ELSIF p_tipo_documento = 'folha_ponto' THEN
    SELECT true, 'Folha de ponto ' || lpad(fp.mes::text,2,'0') || '/' || fp.ano INTO v_ok, v_titulo
      FROM folhas_ponto fp WHERE fp.id = p_referencia_id AND fp.funcionario_id = p_funcionario_id;
  ELSIF p_tipo_documento = 'contracheque' THEN
    SELECT true, 'Contracheque ' || lpad(c.mes::text,2,'0') || '/' || c.ano INTO v_ok, v_titulo
      FROM contracheques c WHERE c.id = p_referencia_id AND c.funcionario_id = p_funcionario_id;
  ELSIF p_tipo_documento = 'comunicado' THEN
    SELECT true, d.titulo, d.hash_documento INTO v_ok, v_titulo, v_doc_hash
      FROM documentos_internos d WHERE d.id = p_referencia_id AND d.ativo
       AND (d.funcionario_ids IS NULL OR p_funcionario_id = ANY(d.funcionario_ids));
    IF v_ok AND v_doc_hash <> p_hash_documento THEN RAISE EXCEPTION 'O documento foi alterado; recarregue a página'; END IF;
  END IF;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Documento não encontrado para este funcionário'; END IF;

  v_hash := encode(digest(p_hash_documento || '|' || p_funcionario_id::text || '|' || p_tipo_documento || '|' ||
    CASE WHEN p_aceite THEN 'assinado' ELSE 'recusado' END || '|' || to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'), 'hex');

  INSERT INTO documentos_internos_assinaturas (tenant_id, funcionario_id, tipo_documento, referencia_id, titulo,
    hash_documento, status, motivo_recusa, distancia_biometrica, threshold, user_agent, ip_origem, hash_assinatura, assinado_em)
  VALUES (v_func.tenant_id, p_funcionario_id, p_tipo_documento, p_referencia_id, v_titulo, p_hash_documento,
    CASE WHEN p_aceite THEN 'assinado' ELSE 'recusado' END, CASE WHEN p_aceite THEN NULL ELSE trim(p_motivo_recusa) END,
    v_dist, CASE WHEN p_aceite THEN c_threshold END, left(p_user_agent, 500), nullif(trim(v_ip),''), v_hash, v_now)
  ON CONFLICT (funcionario_id, tipo_documento, referencia_id) DO NOTHING
  RETURNING documentos_internos_assinaturas.id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Este documento já foi assinado ou recusado'; END IF;

  IF p_tipo_documento = 'folha_ponto' THEN
    UPDATE folhas_ponto SET confirmado = p_aceite, confirmado_at = v_now,
      motivo_discordancia = CASE WHEN p_aceite THEN NULL ELSE trim(p_motivo_recusa) END,
      confirmacao_user_agent = left(p_user_agent,500), confirmacao_ip = nullif(trim(v_ip),'')
     WHERE folhas_ponto.id = p_referencia_id AND confirmado IS NULL;
  ELSIF p_tipo_documento = 'advertencia' AND NOT p_aceite THEN
    UPDATE advertencias_suspensoes SET funcionario_recusou_assinar = true WHERE advertencias_suspensoes.id = p_referencia_id;
  END IF;

  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (NULL, 'documentos_internos_assinaturas', CASE WHEN p_aceite THEN 'ASSINAR_BIOMETRIA' ELSE 'RECUSAR' END,
    jsonb_build_object('assinatura_id', v_id, 'funcionario_id', p_funcionario_id, 'tipo', p_tipo_documento,
      'referencia_id', p_referencia_id, 'hash_documento', p_hash_documento, 'hash_assinatura', v_hash, 'distancia', v_dist), v_func.tenant_id);

  RETURN QUERY SELECT v_id, v_hash, v_now, v_dist;
END $$;

GRANT EXECUTE ON FUNCTION public.biometria_status_funcionario(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autocadastrar_biometria_funcionario(uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_documento_interno(uuid, text, uuid, text, boolean, text, jsonb, text) TO anon, authenticated;