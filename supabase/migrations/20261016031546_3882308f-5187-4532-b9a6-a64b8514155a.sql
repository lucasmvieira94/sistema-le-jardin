CREATE TABLE public.advertencias_testemunhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertencia_id uuid NOT NULL REFERENCES public.advertencias_suspensoes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tenant_id uuid,
  indicado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (advertencia_id, funcionario_id)
);
GRANT SELECT ON public.advertencias_testemunhas TO authenticated;
GRANT ALL ON public.advertencias_testemunhas TO service_role;
ALTER TABLE public.advertencias_testemunhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem testemunhas" ON public.advertencias_testemunhas FOR SELECT TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) AND has_tenant_access(tenant_id)) OR is_super_admin(auth.uid()));

-- Indicação de testemunhas: só após recusa ou prazo vencido do colaborador advertido.
CREATE OR REPLACE FUNCTION public.indicar_testemunhas_advertencia(p_advertencia_id uuid, p_testemunhas uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_adv record; v_status text; v_n int; v_nome text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Apenas administradores podem indicar testemunhas'; END IF;
  SELECT a.*, f.nome_completo AS nome INTO v_adv FROM advertencias_suspensoes a JOIN funcionarios f ON f.id = a.funcionario_id
   WHERE a.id = p_advertencia_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Advertência não encontrada'; END IF;
  IF NOT (is_super_admin(auth.uid()) OR has_tenant_access(v_adv.tenant_id)) THEN RAISE EXCEPTION 'Sem acesso a esta empresa'; END IF;
  IF EXISTS (SELECT 1 FROM advertencias_testemunhas WHERE advertencia_id = p_advertencia_id) THEN
    RAISE EXCEPTION 'As testemunhas desta medida já foram indicadas'; END IF;
  SELECT s.status INTO v_status FROM documentos_internos_assinaturas s
   WHERE s.tipo_documento = 'advertencia' AND s.referencia_id = p_advertencia_id AND s.funcionario_id = v_adv.funcionario_id;
  IF v_status = 'assinado' THEN RAISE EXCEPTION 'O colaborador já assinou; testemunhas não são necessárias'; END IF;
  IF v_status IS NULL AND now() <= prazo_assinatura_em('advertencia', p_advertencia_id, v_adv.created_at, v_adv.funcionario_id) THEN
    RAISE EXCEPTION 'Aguarde o fim do prazo de assinatura do colaborador'; END IF;
  IF coalesce(array_length(p_testemunhas,1),0) <> 2 OR p_testemunhas[1] = p_testemunhas[2] THEN
    RAISE EXCEPTION 'Indique exatamente duas testemunhas diferentes'; END IF;
  IF v_adv.funcionario_id = ANY(p_testemunhas) THEN RAISE EXCEPTION 'O colaborador advertido não pode ser testemunha'; END IF;
  SELECT count(*) INTO v_n FROM funcionarios WHERE id = ANY(p_testemunhas) AND ativo AND tenant_id IS NOT DISTINCT FROM v_adv.tenant_id;
  IF v_n <> 2 THEN RAISE EXCEPTION 'As testemunhas devem ser funcionários ativos da empresa'; END IF;

  INSERT INTO advertencias_testemunhas (advertencia_id, funcionario_id, tenant_id, indicado_por)
  SELECT p_advertencia_id, unnest(p_testemunhas), v_adv.tenant_id, auth.uid();
  UPDATE advertencias_suspensoes SET
    testemunha_1 = (SELECT nome_completo FROM funcionarios WHERE id = p_testemunhas[1]),
    testemunha_2 = (SELECT nome_completo FROM funcionarios WHERE id = p_testemunhas[2]),
    funcionario_recusou_assinar = true
   WHERE id = p_advertencia_id;

  INSERT INTO avisos_funcionario (funcionario_id, tenant_id, tipo, titulo, mensagem, dados, criado_por)
  SELECT f.id, f.tenant_id, 'novo_documento', 'Você foi indicado como testemunha',
    format('Você foi indicado como TESTEMUNHA da medida disciplinar aplicada a %s (a medida não é para você). Acesse Meus Documentos para ler e assinar como testemunha até %s.',
      v_adv.nome, to_char(prazo_assinatura_em('advertencia_testemunha', p_advertencia_id, now(), f.id) AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY "às" HH24:MI')),
    jsonb_build_object('tipo_documento','advertencia_testemunha','referencia_id',p_advertencia_id,'etapa','publicado'), auth.uid()
  FROM funcionarios f WHERE f.id = ANY(p_testemunhas);

  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (auth.uid(), 'advertencias_testemunhas', 'INDICAR_TESTEMUNHAS',
    jsonb_build_object('advertencia_id', p_advertencia_id, 'testemunhas', p_testemunhas, 'status_colaborador', coalesce(v_status,'atrasado')), v_adv.tenant_id);
  RETURN 2;
END $$;
REVOKE ALL ON FUNCTION public.indicar_testemunhas_advertencia(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicar_testemunhas_advertencia(uuid, uuid[]) TO authenticated;

-- Lista de documentos: inclui as medidas em que o colaborador é testemunha.
CREATE OR REPLACE FUNCTION public.listar_documentos_funcionario(p_funcionario_id uuid)
 RETURNS TABLE(tipo_documento text, referencia_id uuid, titulo text, subtitulo text, conteudo_html text, arquivo_path text, hash_referencia text, criado_em timestamp with time zone, status text, assinado_em timestamp with time zone, motivo_recusa text, hash_assinatura text, hash_documento text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    SELECT 'advertencia_testemunha', a.id,
      'Testemunha: ' || CASE a.tipo WHEN 'suspensao' THEN 'suspensão disciplinar' WHEN 'advertencia_verbal' THEN 'advertência verbal' ELSE 'advertência escrita' END || ' de ' || fa.nome_completo,
      'Você é testemunha — a medida é para ' || fa.nome_completo,
      format('<p><b>ATENÇÃO: você está assinando apenas como TESTEMUNHA. Esta medida disciplinar NÃO é para você.</b></p><p><b>Colaborador advertido:</b> %s</p><p><b>Ocorrência em:</b> %s</p><p><b>Motivo:</b> %s</p><p><b>Descrição:</b> %s</p>%s',
        fa.nome_completo, to_char(a.data_ocorrencia::date,'DD/MM/YYYY'), a.motivo, a.descricao,
        CASE WHEN a.dias_suspensao IS NOT NULL THEN format('<p><b>Suspensão:</b> %s dia(s), de %s a %s.</p>', a.dias_suspensao, to_char(a.data_inicio_suspensao::date,'DD/MM/YYYY'), to_char(a.data_fim_suspensao::date,'DD/MM/YYYY')) ELSE '' END),
      NULL, NULL, t.created_at
    FROM advertencias_testemunhas t JOIN f ON f.id = t.funcionario_id
    JOIN advertencias_suspensoes a ON a.id = t.advertencia_id
    JOIN funcionarios fa ON fa.id = a.funcionario_id
    UNION ALL
    SELECT 'folha_ponto', fp.id, 'Folha de ponto ' || lpad(fp.mes::text,2,'0') || '/' || fp.ano, 'Espelho mensal de ponto', NULL, fp.path, NULL, fp.created_at
    FROM folhas_ponto fp JOIN f ON f.id = fp.funcionario_id
    UNION ALL
    SELECT 'contracheque', c.id, 'Contracheque ' || lpad(c.mes::text,2,'0') || '/' || c.ano, 'Recibo de pagamento de salário', NULL, c.path, NULL, c.created_at
    FROM contracheques c JOIN f ON f.id = c.funcionario_id
    UNION ALL
    SELECT 'comunicado', d.id, d.titulo,
      CASE d.tipo WHEN 'regimento' THEN 'Regimento interno' WHEN 'politica' THEN 'Política interna' ELSE 'Comunicado' END,
      d.conteudo_html, d.arquivo_path, d.hash_documento, d.created_at
    FROM documentos_internos d, f
    WHERE d.ativo AND (d.funcionario_ids IS NULL OR f.id = ANY(d.funcionario_ids))
  )
  SELECT d.t, d.id, d.titulo, d.sub, d.html, d.path, d.h, d.c,
    COALESCE(s.status, 'pendente'), s.assinado_em, s.motivo_recusa, s.hash_assinatura, s.hash_documento
  FROM docs d
  LEFT JOIN documentos_internos_assinaturas s
    ON s.funcionario_id = p_funcionario_id AND s.tipo_documento = d.t AND s.referencia_id = d.id
  ORDER BY (s.status IS NULL) DESC, d.c DESC
$function$;

CREATE OR REPLACE FUNCTION public.assinar_documento_interno(p_funcionario_id uuid, p_tipo_documento text, p_referencia_id uuid, p_hash_documento text, p_aceite boolean, p_motivo_recusa text, p_descriptor jsonb, p_user_agent text)
 RETURNS TABLE(id uuid, hash_assinatura text, assinado_em timestamp with time zone, distancia numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
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
  ELSIF p_tipo_documento = 'advertencia_testemunha' THEN
    SELECT true, 'Testemunha da medida disciplinar de ' || fa.nome_completo || ' (' || to_char(a.data_ocorrencia::date,'DD/MM/YYYY') || ')'
      INTO v_ok, v_titulo
      FROM advertencias_testemunhas t JOIN advertencias_suspensoes a ON a.id = t.advertencia_id
      JOIN funcionarios fa ON fa.id = a.funcionario_id
     WHERE t.advertencia_id = p_referencia_id AND t.funcionario_id = p_funcionario_id;
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
END $function$;