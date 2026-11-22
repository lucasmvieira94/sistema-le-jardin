CREATE TABLE public.residentes_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id),
  texto text NOT NULL,
  valida_ate date,
  autor_funcionario_id uuid REFERENCES public.funcionarios(id),
  autor_usuario_id uuid,
  autor_nome text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','remocao_pendente','removida')),
  motivo_remocao text,
  remocao_solicitada_por uuid,
  remocao_solicitada_em timestamptz,
  revisado_por uuid,
  revisado_em timestamptz,
  observacao_gestor text,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX residentes_observacoes_residente_idx ON public.residentes_observacoes(residente_id, status);
CREATE INDEX residentes_observacoes_autor_idx ON public.residentes_observacoes(autor_funcionario_id);
GRANT SELECT ON public.residentes_observacoes TO authenticated;
GRANT ALL ON public.residentes_observacoes TO service_role;
ALTER TABLE public.residentes_observacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores consultam observações" ON public.residentes_observacoes FOR SELECT TO authenticated
  USING (coalesce(public.eh_gestor(auth.uid()), false) AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id)));

CREATE OR REPLACE FUNCTION public.obs_hoje() RETURNS date LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE OR REPLACE FUNCTION public.obs_validar(p_texto text, p_valida_ate date) RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  IF length(trim(coalesce(p_texto,''))) < 3 OR length(p_texto) > 1000 THEN RAISE EXCEPTION 'Escreva a observação (até 1000 letras)'; END IF;
  IF p_valida_ate IS NOT NULL AND p_valida_ate < public.obs_hoje() THEN RAISE EXCEPTION 'A validade não pode ser anterior a hoje'; END IF;
END $$;

-- Helper do portal: funcionário com Portal de Cuidados e residente acessível
CREATE OR REPLACE FUNCTION public.obs_portal_contexto(p_residente uuid, OUT funcionario uuid, OUT tenant uuid, OUT nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  funcionario := public.portal_cuidados_funcionario();
  IF funcionario IS NULL THEN RAISE EXCEPTION 'Acesso ao Portal de Cuidados não autorizado' USING ERRCODE='42501'; END IF;
  SELECT f.tenant_id, f.nome_completo INTO tenant, nome FROM funcionarios f WHERE f.id = funcionario;
  IF NOT EXISTS (SELECT 1 FROM residentes r WHERE r.id = p_residente AND r.ativo AND (tenant IS NULL OR r.tenant_id IS NULL OR r.tenant_id = tenant)) THEN
    RAISE EXCEPTION 'Residente não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.portal_observacoes_residente(p_residente_id uuid)
RETURNS TABLE(id uuid, texto text, valida_ate date, autor text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.obs_portal_contexto(p_residente_id);
  RETURN QUERY SELECT o.id, o.texto, o.valida_ate, o.autor_nome, o.created_at FROM residentes_observacoes o
  WHERE o.residente_id = p_residente_id AND o.status = 'ativa' AND (o.valida_ate IS NULL OR o.valida_ate >= public.obs_hoje())
  ORDER BY o.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.portal_criar_observacao(p_residente_id uuid, p_texto text, p_valida_ate date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; v uuid;
BEGIN
  c := public.obs_portal_contexto(p_residente_id);
  PERFORM public.obs_validar(p_texto, p_valida_ate);
  INSERT INTO residentes_observacoes (residente_id, texto, valida_ate, autor_funcionario_id, autor_nome, tenant_id)
  VALUES (p_residente_id, trim(p_texto), p_valida_ate, c.funcionario, c.nome, c.tenant) RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.portal_solicitar_remocao_observacao(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; c record;
BEGIN
  IF length(trim(coalesce(p_motivo,''))) < 10 OR length(p_motivo) > 500 THEN RAISE EXCEPTION 'Justifique a exclusão (mínimo 10 letras)'; END IF;
  SELECT * INTO o FROM residentes_observacoes WHERE id = p_id AND status = 'ativa' FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Observação indisponível'; END IF;
  c := public.obs_portal_contexto(o.residente_id);
  UPDATE residentes_observacoes SET status = 'remocao_pendente', motivo_remocao = trim(p_motivo), remocao_solicitada_por = c.funcionario,
    remocao_solicitada_em = now(), updated_at = now() WHERE id = p_id;
END $$;

-- Gestor
CREATE OR REPLACE FUNCTION public.obs_exigir_gestor() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN IF NOT coalesce(public.eh_gestor(auth.uid()), false) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF; END $$;

CREATE OR REPLACE FUNCTION public.gestor_criar_observacao(p_residente_id uuid, p_texto text, p_valida_ate date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_t uuid; v uuid;
BEGIN
  PERFORM public.obs_exigir_gestor();
  SELECT tenant_id INTO v_t FROM residentes WHERE id = p_residente_id;
  IF NOT FOUND OR (v_t IS NOT NULL AND NOT public.has_tenant_access(v_t)) THEN RAISE EXCEPTION 'Residente não encontrado'; END IF;
  PERFORM public.obs_validar(p_texto, p_valida_ate);
  INSERT INTO residentes_observacoes (residente_id, texto, valida_ate, autor_usuario_id, autor_nome, tenant_id)
  VALUES (p_residente_id, trim(p_texto), p_valida_ate, auth.uid(), 'Gestor', v_t) RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.gestor_remover_observacao(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.obs_exigir_gestor();
  IF length(trim(coalesce(p_motivo,''))) < 10 OR length(p_motivo) > 500 THEN RAISE EXCEPTION 'Justifique a exclusão (mínimo 10 letras)'; END IF;
  UPDATE residentes_observacoes SET status = 'removida', motivo_remocao = coalesce(motivo_remocao, trim(p_motivo)),
    observacao_gestor = trim(p_motivo), revisado_por = auth.uid(), revisado_em = now(), updated_at = now()
  WHERE id = p_id AND status IN ('ativa','remocao_pendente') AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Observação indisponível'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gestor_observacoes_residente(p_residente_id uuid)
RETURNS TABLE(id uuid, texto text, valida_ate date, autor text, status text, motivo_remocao text, created_at timestamptz, vencida boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.obs_exigir_gestor();
  RETURN QUERY SELECT o.id, o.texto, o.valida_ate, o.autor_nome, o.status, o.motivo_remocao, o.created_at,
    (o.valida_ate IS NOT NULL AND o.valida_ate < public.obs_hoje())
  FROM residentes_observacoes o WHERE o.residente_id = p_residente_id AND (o.tenant_id IS NULL OR public.has_tenant_access(o.tenant_id))
  ORDER BY (o.status <> 'removida') DESC, o.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.gestor_observacoes_remocao(p_status text DEFAULT 'pendente')
RETURNS TABLE(id uuid, residente text, texto text, valida_ate date, autor text, motivo text, solicitante text,
  status text, solicitado_em timestamptz, revisado_em timestamptz, observacao_gestor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.obs_exigir_gestor();
  RETURN QUERY SELECT o.id, r.nome_completo, o.texto, o.valida_ate, o.autor_nome, o.motivo_remocao, f.nome_completo,
    CASE WHEN o.status = 'remocao_pendente' THEN 'pendente' WHEN o.status = 'removida' THEN 'aprovada' ELSE 'rejeitada' END,
    o.remocao_solicitada_em, o.revisado_em, o.observacao_gestor
  FROM residentes_observacoes o JOIN residentes r ON r.id = o.residente_id
  LEFT JOIN funcionarios f ON f.id = o.remocao_solicitada_por
  WHERE o.remocao_solicitada_em IS NOT NULL AND (o.tenant_id IS NULL OR public.has_tenant_access(o.tenant_id))
    AND ((p_status = 'pendente' AND o.status = 'remocao_pendente')
      OR (p_status = 'aprovada' AND o.status = 'removida')
      OR (p_status = 'rejeitada' AND o.status = 'ativa'))
  ORDER BY o.remocao_solicitada_em DESC LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.gestor_revisar_remocao_observacao(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.obs_exigir_gestor();
  IF length(coalesce(p_observacao,'')) > 500 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
  UPDATE residentes_observacoes SET status = CASE WHEN p_aprovar THEN 'removida' ELSE 'ativa' END,
    revisado_por = auth.uid(), revisado_em = now(), observacao_gestor = nullif(trim(p_observacao),''), updated_at = now()
  WHERE id = p_id AND status = 'remocao_pendente' AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido indisponível ou já decidido'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.obs_portal_contexto(uuid), public.obs_exigir_gestor(), public.obs_validar(text,date), public.obs_hoje() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_observacoes_residente(uuid), public.portal_criar_observacao(uuid,text,date), public.portal_solicitar_remocao_observacao(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_observacoes_residente(uuid), public.portal_criar_observacao(uuid,text,date), public.portal_solicitar_remocao_observacao(uuid,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gestor_criar_observacao(uuid,text,date), public.gestor_remover_observacao(uuid,text), public.gestor_observacoes_residente(uuid), public.gestor_observacoes_remocao(text), public.gestor_revisar_remocao_observacao(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_criar_observacao(uuid,text,date), public.gestor_remover_observacao(uuid,text), public.gestor_observacoes_residente(uuid), public.gestor_observacoes_remocao(text), public.gestor_revisar_remocao_observacao(uuid,boolean,text) TO authenticated;