ALTER TABLE public.configuracoes_empresa ADD COLUMN IF NOT EXISTS prazo_assinatura_dias integer NOT NULL DEFAULT 3;
ALTER TABLE public.documentos_internos ADD COLUMN IF NOT EXISTS prazo_assinatura date;

-- Prazo final (fim do dia em Brasília quando for data própria do comunicado)
CREATE OR REPLACE FUNCTION public.prazo_assinatura_em(p_tipo text, p_ref uuid, p_criado timestamptz, p_func uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT ((d.prazo_assinatura + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') - interval '1 second'
       FROM documentos_internos d WHERE p_tipo = 'comunicado' AND d.id = p_ref AND d.prazo_assinatura IS NOT NULL),
    p_criado + make_interval(days => COALESCE(
      (SELECT ce.prazo_assinatura_dias FROM configuracoes_empresa ce JOIN funcionarios f ON f.tenant_id = ce.tenant_id WHERE f.id = p_func LIMIT 1),
      (SELECT prazo_assinatura_dias FROM configuracoes_empresa ORDER BY created_at LIMIT 1), 3)))
$$;
REVOKE EXECUTE ON FUNCTION public.prazo_assinatura_em(text, uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

-- Aviso na publicação, agora com o prazo
CREATE OR REPLACE FUNCTION public.avisar_novo_documento_assinatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text; v_titulo text; v_ids uuid[];
BEGIN
  IF TG_TABLE_NAME = 'advertencias_suspensoes' THEN
    v_tipo := 'advertencia'; v_titulo := 'Advertência/suspensão'; v_ids := ARRAY[NEW.funcionario_id];
  ELSIF TG_TABLE_NAME = 'folhas_ponto' THEN
    IF TG_OP = 'UPDATE' AND NEW.path IS NOT DISTINCT FROM OLD.path THEN RETURN NEW; END IF;
    v_tipo := 'folha_ponto'; v_titulo := 'Folha de ponto ' || lpad(NEW.mes::text,2,'0') || '/' || NEW.ano; v_ids := ARRAY[NEW.funcionario_id];
  ELSIF TG_TABLE_NAME = 'contracheques' THEN
    v_tipo := 'contracheque'; v_titulo := 'Contracheque ' || lpad(NEW.mes::text,2,'0') || '/' || NEW.ano; v_ids := ARRAY[NEW.funcionario_id];
  ELSE
    IF NOT NEW.ativo THEN RETURN NEW; END IF;
    v_tipo := 'comunicado'; v_titulo := NEW.titulo;
    v_ids := COALESCE(NEW.funcionario_ids, ARRAY(SELECT id FROM funcionarios WHERE ativo AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id));
  END IF;
  INSERT INTO avisos_funcionario (funcionario_id, tenant_id, tipo, titulo, mensagem, dados, criado_por)
  SELECT f.id, f.tenant_id, 'novo_documento', 'Novo documento para assinar',
    format('O documento "%s" está disponível para sua assinatura em Meus Documentos. Prazo para assinar: até %s. Leia com atenção e assine ou registre sua discordância.',
      v_titulo, to_char(prazo_assinatura_em(v_tipo, NEW.id, now(), f.id) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')),
    jsonb_build_object('tipo_documento', v_tipo, 'referencia_id', NEW.id, 'etapa', 'publicado'), auth.uid()
  FROM funcionarios f WHERE f.id = ANY(v_ids) AND f.ativo;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.avisar_novo_documento_assinatura() FROM PUBLIC, anon, authenticated;

-- Lembretes de véspera e de atraso: criados ao entrar no portal, uma vez por documento/etapa
CREATE OR REPLACE FUNCTION public.gerar_lembretes_assinatura(p_funcionario_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_prazo timestamptz; v_etapa text; v_tenant uuid; v_n integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM funcionarios WHERE id = p_funcionario_id AND ativo;
  IF NOT FOUND THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM listar_documentos_funcionario(p_funcionario_id) WHERE status = 'pendente' LOOP
    v_prazo := prazo_assinatura_em(r.tipo_documento, r.referencia_id, r.criado_em, p_funcionario_id);
    v_etapa := CASE WHEN now() > v_prazo THEN 'atrasado' WHEN now() >= v_prazo - interval '1 day' THEN 'vespera' END;
    CONTINUE WHEN v_etapa IS NULL;
    CONTINUE WHEN EXISTS (SELECT 1 FROM avisos_funcionario a WHERE a.funcionario_id = p_funcionario_id
      AND a.tipo = 'novo_documento' AND a.dados->>'referencia_id' = r.referencia_id::text AND a.dados->>'etapa' = v_etapa);
    INSERT INTO avisos_funcionario (funcionario_id, tenant_id, tipo, titulo, mensagem, dados)
    VALUES (p_funcionario_id, v_tenant, 'novo_documento',
      CASE v_etapa WHEN 'atrasado' THEN 'Assinatura atrasada' ELSE 'Falta 1 dia para assinar' END,
      CASE v_etapa
        WHEN 'atrasado' THEN format('O prazo para assinar "%s" terminou em %s. Acesse Meus Documentos e assine ou registre sua discordância o quanto antes.', r.titulo, to_char(v_prazo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'))
        ELSE format('O prazo para assinar "%s" termina em %s. Acesse Meus Documentos para assinar.', r.titulo, to_char(v_prazo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'))
      END,
      jsonb_build_object('tipo_documento', r.tipo_documento, 'referencia_id', r.referencia_id, 'etapa', v_etapa, 'prazo', v_prazo));
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_lembretes_assinatura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_lembretes_assinatura(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.painel_assinaturas_documentos();
CREATE FUNCTION public.painel_assinaturas_documentos()
RETURNS TABLE(funcionario_id uuid, funcionario_nome text, funcao text, tipo_documento text, referencia_id uuid,
  titulo text, subtitulo text, criado_em timestamptz, status text, assinado_em timestamptz, motivo_recusa text, hash_assinatura text, prazo_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o painel de assinaturas';
  END IF;
  RETURN QUERY
  SELECT f.id, f.nome_completo::text, f.funcao::text, d.tipo_documento, d.referencia_id, d.titulo, d.subtitulo,
         d.criado_em, d.status, d.assinado_em, d.motivo_recusa, d.hash_assinatura,
         prazo_assinatura_em(d.tipo_documento, d.referencia_id, d.criado_em, f.id)
  FROM funcionarios f
  CROSS JOIN LATERAL listar_documentos_funcionario(f.id) d
  WHERE f.ativo AND (is_super_admin(auth.uid()) OR has_tenant_access(f.tenant_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.painel_assinaturas_documentos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_assinaturas_documentos() TO authenticated;