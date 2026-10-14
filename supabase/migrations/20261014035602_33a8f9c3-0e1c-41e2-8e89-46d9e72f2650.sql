CREATE OR REPLACE FUNCTION public.painel_assinaturas_documentos()
RETURNS TABLE(funcionario_id uuid, funcionario_nome text, funcao text, tipo_documento text, referencia_id uuid,
  titulo text, subtitulo text, criado_em timestamptz, status text, assinado_em timestamptz, motivo_recusa text, hash_assinatura text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o painel de assinaturas';
  END IF;
  RETURN QUERY
  SELECT f.id, f.nome_completo::text, f.funcao::text, d.tipo_documento, d.referencia_id, d.titulo, d.subtitulo,
         d.criado_em, d.status, d.assinado_em, d.motivo_recusa, d.hash_assinatura
  FROM funcionarios f
  CROSS JOIN LATERAL listar_documentos_funcionario(f.id) d
  WHERE f.ativo AND (is_super_admin(auth.uid()) OR has_tenant_access(f.tenant_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.painel_assinaturas_documentos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_assinaturas_documentos() TO authenticated;

-- Alerta ao colaborador quando um documento novo entra para assinatura
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
    format('O documento "%s" está disponível para sua assinatura em Meus Documentos. Leia com atenção e assine ou registre sua discordância.', v_titulo),
    jsonb_build_object('tipo_documento', v_tipo, 'referencia_id', NEW.id), auth.uid()
  FROM funcionarios f WHERE f.id = ANY(v_ids) AND f.ativo;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.avisar_novo_documento_assinatura() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_aviso_doc_advertencia AFTER INSERT ON public.advertencias_suspensoes FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_documento_assinatura();
CREATE TRIGGER trg_aviso_doc_folha AFTER INSERT OR UPDATE OF path ON public.folhas_ponto FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_documento_assinatura();
CREATE TRIGGER trg_aviso_doc_contracheque AFTER INSERT ON public.contracheques FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_documento_assinatura();
CREATE TRIGGER trg_aviso_doc_interno AFTER INSERT ON public.documentos_internos FOR EACH ROW EXECUTE FUNCTION public.avisar_novo_documento_assinatura();