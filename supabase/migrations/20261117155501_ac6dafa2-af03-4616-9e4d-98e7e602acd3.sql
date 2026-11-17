CREATE TABLE public.remocoes_estoque_medicamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estoque_medicamento_id uuid NOT NULL REFERENCES public.estoque_medicamentos(id),
  residente_id uuid NOT NULL REFERENCES public.residentes(id),
  solicitado_por uuid NOT NULL REFERENCES public.funcionarios(id),
  motivo text NOT NULL,
  quantidade_no_pedido numeric,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  revisado_por uuid,
  revisado_em timestamptz,
  observacao_gestor text,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX remocoes_estoque_pendente_uq ON public.remocoes_estoque_medicamentos(estoque_medicamento_id) WHERE status = 'pendente';
GRANT SELECT ON public.remocoes_estoque_medicamentos TO authenticated;
GRANT ALL ON public.remocoes_estoque_medicamentos TO service_role;
ALTER TABLE public.remocoes_estoque_medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores consultam remoções" ON public.remocoes_estoque_medicamentos FOR SELECT TO authenticated
  USING (public.eh_gestor(auth.uid()) AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id)));

-- Cuidador pede remoção: remédio sai do estoque temporariamente até a decisão do gestor
CREATE OR REPLACE FUNCTION public.portal_solicitar_remocao_estoque(p_estoque_id uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_f uuid; v_t uuid; e record; v_id uuid;
BEGIN
  v_f := public.portal_med_funcionario();
  SELECT tenant_id INTO v_t FROM funcionarios WHERE id = v_f;
  IF length(trim(coalesce(p_motivo,''))) < 10 OR length(p_motivo) > 500 THEN
    RAISE EXCEPTION 'Justifique a remoção (mínimo 10 letras)'; END IF;
  SELECT * INTO e FROM estoque_medicamentos WHERE id = p_estoque_id AND tipo_estoque = 'residente' AND coalesce(ativo,true);
  IF e.id IS NULL THEN RAISE EXCEPTION 'Medicamento não está no estoque do residente'; END IF;
  PERFORM public.portal_med_residente_ok(e.residente_id, v_t);
  INSERT INTO remocoes_estoque_medicamentos (estoque_medicamento_id, residente_id, solicitado_por, motivo, quantidade_no_pedido, tenant_id)
  VALUES (e.id, e.residente_id, v_f, trim(p_motivo), e.quantidade_atual, coalesce(e.tenant_id, v_t)) RETURNING id INTO v_id;
  UPDATE estoque_medicamentos SET ativo = false WHERE id = e.id;
  RETURN v_id;
END $$;

-- Lista para o gestor
CREATE OR REPLACE FUNCTION public.gestor_remocoes_estoque(p_status text DEFAULT 'pendente')
RETURNS TABLE(id uuid, residente text, medicamento text, quantidade numeric, motivo text, solicitante text,
  status text, created_at timestamptz, revisado_em timestamptz, observacao_gestor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.eh_gestor(auth.uid()) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT x.id, r.nome_completo, m.nome, x.quantidade_no_pedido, x.motivo, f.nome_completo,
    x.status, x.created_at, x.revisado_em, x.observacao_gestor
  FROM remocoes_estoque_medicamentos x
  JOIN estoque_medicamentos e ON e.id = x.estoque_medicamento_id
  JOIN medicamentos m ON m.id = e.medicamento_id
  JOIN residentes r ON r.id = x.residente_id
  LEFT JOIN funcionarios f ON f.id = x.solicitado_por
  WHERE x.status = p_status AND (x.tenant_id IS NULL OR public.has_tenant_access(x.tenant_id))
  ORDER BY x.created_at DESC LIMIT 200;
END $$;

-- Decisão do gestor: aprovar mantém removido; recusar devolve ao estoque
CREATE OR REPLACE FUNCTION public.gestor_revisar_remocao_estoque(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x record;
BEGIN
  IF NOT public.eh_gestor(auth.uid()) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF;
  IF length(coalesce(p_observacao,'')) > 500 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
  SELECT * INTO x FROM remocoes_estoque_medicamentos WHERE id = p_id AND status = 'pendente'
    AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id)) FOR UPDATE;
  IF x.id IS NULL THEN RAISE EXCEPTION 'Pedido indisponível ou já decidido'; END IF;
  UPDATE remocoes_estoque_medicamentos SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
    revisado_por = auth.uid(), revisado_em = now(), observacao_gestor = nullif(trim(p_observacao),''), updated_at = now()
  WHERE id = p_id;
  IF NOT p_aprovar THEN UPDATE estoque_medicamentos SET ativo = true WHERE id = x.estoque_medicamento_id; END IF;
END $$;

REVOKE ALL ON FUNCTION public.portal_solicitar_remocao_estoque(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_remocao_estoque(uuid,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gestor_remocoes_estoque(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_remocoes_estoque(text) TO authenticated;
REVOKE ALL ON FUNCTION public.gestor_revisar_remocao_estoque(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestor_revisar_remocao_estoque(uuid,boolean,text) TO authenticated;