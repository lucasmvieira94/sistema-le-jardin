CREATE TABLE public.documentos_internos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  tipo text NOT NULL DEFAULT 'comunicado',
  titulo text NOT NULL,
  conteudo_html text NOT NULL,
  hash_documento text NOT NULL,
  funcionario_ids uuid[],
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.documentos_internos TO authenticated;
GRANT ALL ON public.documentos_internos TO service_role;
ALTER TABLE public.documentos_internos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam documentos internos" ON public.documentos_internos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER documentos_internos_updated_at BEFORE UPDATE ON public.documentos_internos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.documentos_internos_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  referencia_id uuid NOT NULL,
  titulo text NOT NULL,
  hash_documento text NOT NULL,
  status text NOT NULL,
  motivo_recusa text,
  metodo text NOT NULL DEFAULT 'biometria_facial',
  distancia_biometrica numeric,
  threshold numeric,
  user_agent text,
  ip_origem text,
  hash_assinatura text NOT NULL,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, tipo_documento, referencia_id)
);
GRANT SELECT ON public.documentos_internos_assinaturas TO authenticated;
GRANT ALL ON public.documentos_internos_assinaturas TO service_role;
ALTER TABLE public.documentos_internos_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem assinaturas internas" ON public.documentos_internos_assinaturas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.impedir_alteracao_assinatura_interna()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Assinaturas de documentos internos são imutáveis'; END $$;
CREATE TRIGGER trg_assinatura_interna_imutavel BEFORE UPDATE OR DELETE ON public.documentos_internos_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_assinatura_interna();

-- Lista unificada para o portal (acesso por código)
CREATE OR REPLACE FUNCTION public.listar_documentos_funcionario(p_funcionario_id uuid)
RETURNS TABLE(tipo_documento text, referencia_id uuid, titulo text, subtitulo text, conteudo_html text,
  arquivo_path text, hash_referencia text, criado_em timestamptz, status text, assinado_em timestamptz,
  motivo_recusa text, hash_assinatura text, hash_documento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (SELECT id FROM funcionarios WHERE id = p_funcionario_id AND ativo),
  docs AS (
    SELECT 'advertencia'::text t, a.id, 
      CASE a.tipo WHEN 'suspensao' THEN 'Suspensão disciplinar' WHEN 'advertencia_verbal' THEN 'Advertência verbal' ELSE 'Advertência escrita' END titulo,
      'Ocorrência em ' || to_char(a.data_ocorrencia::date,'DD/MM/YYYY') sub,
      format('<p><b>Motivo:</b> %s</p><p><b>Descrição:</b> %s</p>%s%s',
        a.motivo, a.descricao,
        CASE WHEN a.dias_suspensao IS NOT NULL THEN format('<p><b>Suspensão:</b> %s dia(s), de %s a %s.</p>', a.dias_suspensao, to_char(a.data_inicio_suspensao::date,'DD/MM/YYYY'), to_char(a.data_fim_suspensao::date,'DD/MM/YYYY')) ELSE '' END,
        CASE WHEN a.observacoes IS NOT NULL THEN format('<p><b>Observações:</b> %s</p>', a.observacoes) ELSE '' END) html,
      NULL::text path, a.hash_verificacao h, a.created_at c
    FROM advertencias_suspensoes a JOIN f ON f.id = a.funcionario_id
    UNION ALL
    SELECT 'folha_ponto', fp.id, 'Folha de ponto ' || lpad(fp.mes::text,2,'0') || '/' || fp.ano, 'Espelho mensal de ponto', NULL, fp.path, NULL, fp.created_at
    FROM folhas_ponto fp JOIN f ON f.id = fp.funcionario_id
    UNION ALL
    SELECT 'contracheque', c.id, 'Contracheque ' || lpad(c.mes::text,2,'0') || '/' || c.ano, 'Recibo de pagamento de salário', NULL, c.path, NULL, c.created_at
    FROM contracheques c JOIN f ON f.id = c.funcionario_id
    UNION ALL
    SELECT 'comunicado', d.id, d.titulo,
      CASE d.tipo WHEN 'regimento' THEN 'Regimento interno' WHEN 'politica' THEN 'Política interna' ELSE 'Comunicado' END,
      d.conteudo_html, NULL, d.hash_documento, d.created_at
    FROM documentos_internos d, f
    WHERE d.ativo AND (d.funcionario_ids IS NULL OR f.id = ANY(d.funcionario_ids))
  )
  SELECT d.t, d.id, d.titulo, d.sub, d.html, d.path, d.h, d.c,
    COALESCE(s.status, 'pendente'), s.assinado_em, s.motivo_recusa, s.hash_assinatura, s.hash_documento
  FROM docs d
  LEFT JOIN documentos_internos_assinaturas s
    ON s.funcionario_id = p_funcionario_id AND s.tipo_documento = d.t AND s.referencia_id = d.id
  ORDER BY (s.status IS NULL) DESC, d.c DESC
$$;

CREATE OR REPLACE FUNCTION public.assinar_documento_interno(
  p_funcionario_id uuid, p_tipo_documento text, p_referencia_id uuid, p_hash_documento text,
  p_aceite boolean, p_motivo_recusa text, p_distancia numeric, p_threshold numeric, p_user_agent text)
RETURNS TABLE(id uuid, hash_assinatura text, assinado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_func RECORD; v_titulo text; v_ok boolean := false; v_hash text; v_now timestamptz := now();
  v_id uuid; v_ip text; v_doc_hash text;
BEGIN
  SELECT fu.id, fu.tenant_id, fu.nome INTO v_func FROM funcionarios fu WHERE fu.id = p_funcionario_id AND fu.ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado ou inativo'; END IF;
  IF p_hash_documento IS NULL OR length(p_hash_documento) <> 64 THEN RAISE EXCEPTION 'Hash do documento inválido'; END IF;
  IF p_aceite THEN
    IF p_distancia IS NULL OR p_threshold IS NULL OR p_distancia >= p_threshold THEN
      RAISE EXCEPTION 'Validação biométrica não confirmada';
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

  BEGIN
    v_ip := split_part(coalesce((current_setting('request.headers', true)::jsonb)->>'x-forwarded-for',''), ',', 1);
  EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_hash := encode(digest(p_hash_documento || '|' || p_funcionario_id::text || '|' || p_tipo_documento || '|' ||
    CASE WHEN p_aceite THEN 'assinado' ELSE 'recusado' END || '|' || to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'), 'hex');

  INSERT INTO documentos_internos_assinaturas (tenant_id, funcionario_id, tipo_documento, referencia_id, titulo,
    hash_documento, status, motivo_recusa, distancia_biometrica, threshold, user_agent, ip_origem, hash_assinatura, assinado_em)
  VALUES (v_func.tenant_id, p_funcionario_id, p_tipo_documento, p_referencia_id, v_titulo, p_hash_documento,
    CASE WHEN p_aceite THEN 'assinado' ELSE 'recusado' END, CASE WHEN p_aceite THEN NULL ELSE trim(p_motivo_recusa) END,
    p_distancia, p_threshold, left(p_user_agent, 500), nullif(trim(v_ip),''), v_hash, v_now)
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
      'referencia_id', p_referencia_id, 'hash_documento', p_hash_documento, 'hash_assinatura', v_hash), v_func.tenant_id);

  RETURN QUERY SELECT v_id, v_hash, v_now;
END $$;

GRANT EXECUTE ON FUNCTION public.listar_documentos_funcionario(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_documento_interno(uuid, text, uuid, text, boolean, text, numeric, numeric, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.impedir_alteracao_assinatura_interna() FROM PUBLIC, anon, authenticated;