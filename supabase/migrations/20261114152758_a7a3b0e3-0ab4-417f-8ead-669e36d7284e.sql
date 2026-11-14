CREATE TABLE public.cuidados_rotinas_anexos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rotina_id uuid NOT NULL REFERENCES public.cuidados_rotinas(id), tenant_id uuid,
 arquivo_path text NOT NULL, nome_arquivo text NOT NULL, tipo_mime text NOT NULL, tamanho_bytes int NOT NULL, hash_sha256 text NOT NULL,
 enviado_por uuid NOT NULL REFERENCES public.funcionarios(id), removido_em timestamptz, removido_por uuid REFERENCES public.funcionarios(id), motivo_remocao text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cuidados_rotinas_anexos TO service_role;
ALTER TABLE public.cuidados_rotinas_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages routine attachments" ON public.cuidados_rotinas_anexos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX cuidados_rotinas_anexos_rotina_idx ON public.cuidados_rotinas_anexos(rotina_id);

-- Usado pela função de envio: confirma passe + rotina do mesmo residencial e devolve quem envia
CREATE FUNCTION public.portal_rotina_anexo_autorizar(_rotina_id uuid) RETURNS TABLE(funcionario_id uuid, tenant_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 IF NOT EXISTS(SELECT 1 FROM public.cuidados_rotinas c WHERE c.id=_rotina_id AND c.tenant_id IS NOT DISTINCT FROM t AND c.encerrada_em IS NULL) THEN RAISE EXCEPTION 'Rotina não encontrada ou encerrada' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT v, t;
END $$;

CREATE FUNCTION public.portal_rotina_anexo_caminho(_anexo_id uuid) RETURNS TABLE(arquivo_path text, tipo_mime text, nome_arquivo text, hash_sha256 text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 RETURN QUERY SELECT a.arquivo_path,a.tipo_mime,a.nome_arquivo,a.hash_sha256 FROM public.cuidados_rotinas_anexos a WHERE a.id=_anexo_id AND a.tenant_id IS NOT DISTINCT FROM t AND a.removido_em IS NULL;
END $$;

CREATE FUNCTION public.portal_rotina_anexos(_rotina_id uuid) RETURNS TABLE(id uuid,nome_arquivo text,tipo_mime text,tamanho_bytes int,enviado_por_nome text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 RETURN QUERY SELECT a.id,a.nome_arquivo,a.tipo_mime,a.tamanho_bytes,f.nome_completo::text,a.created_at FROM public.cuidados_rotinas_anexos a LEFT JOIN public.funcionarios f ON f.id=a.enviado_por
 WHERE a.rotina_id=_rotina_id AND a.tenant_id IS NOT DISTINCT FROM t AND a.removido_em IS NULL ORDER BY a.created_at;
END $$;

CREATE FUNCTION public.portal_rotina_anexo_remover(_anexo_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; t uuid;
BEGIN
 v:=public.portal_cuidados_funcionario(); IF v IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
 IF _motivo IS NULL OR length(btrim(_motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
 SELECT f.tenant_id INTO t FROM public.funcionarios f WHERE f.id=v;
 UPDATE public.cuidados_rotinas_anexos SET removido_em=now(),removido_por=v,motivo_remocao=btrim(_motivo) WHERE id=_anexo_id AND tenant_id IS NOT DISTINCT FROM t AND removido_em IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Anexo não encontrado'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.portal_rotina_anexo_autorizar(uuid),public.portal_rotina_anexo_caminho(uuid),public.portal_rotina_anexos(uuid),public.portal_rotina_anexo_remover(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_rotina_anexo_autorizar(uuid),public.portal_rotina_anexo_caminho(uuid),public.portal_rotina_anexos(uuid),public.portal_rotina_anexo_remover(uuid,text) TO anon,authenticated,service_role;