CREATE OR REPLACE FUNCTION public.gestor_remocoes_estoque(p_status text DEFAULT 'pendente')
RETURNS TABLE(id uuid, residente text, medicamento text, quantidade numeric, motivo text, solicitante text,
  status text, created_at timestamptz, revisado_em timestamptz, observacao_gestor text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT coalesce(public.eh_gestor(auth.uid()), false) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF;
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

CREATE OR REPLACE FUNCTION public.gestor_revisar_remocao_estoque(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE x record;
BEGIN
  IF NOT coalesce(public.eh_gestor(auth.uid()), false) THEN RAISE EXCEPTION 'Somente gestor' USING ERRCODE='42501'; END IF;
  IF length(coalesce(p_observacao,'')) > 500 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
  SELECT * INTO x FROM remocoes_estoque_medicamentos WHERE id = p_id AND status = 'pendente'
    AND (tenant_id IS NULL OR public.has_tenant_access(tenant_id)) FOR UPDATE;
  IF x.id IS NULL THEN RAISE EXCEPTION 'Pedido indisponível ou já decidido'; END IF;
  UPDATE remocoes_estoque_medicamentos SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
    revisado_por = auth.uid(), revisado_em = now(), observacao_gestor = nullif(trim(p_observacao),''), updated_at = now()
  WHERE id = p_id;
  IF NOT p_aprovar THEN UPDATE estoque_medicamentos SET ativo = true WHERE id = x.estoque_medicamento_id; END IF;
END $$;
CREATE INDEX IF NOT EXISTS remocoes_estoque_residente_idx ON public.remocoes_estoque_medicamentos(residente_id);
CREATE INDEX IF NOT EXISTS remocoes_estoque_solicitante_idx ON public.remocoes_estoque_medicamentos(solicitado_por);