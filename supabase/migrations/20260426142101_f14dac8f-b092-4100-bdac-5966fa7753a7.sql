
-- Adicionar checagem de super_admin nas funções (apenas quando chamadas por usuário autenticado)
CREATE OR REPLACE FUNCTION public.gerar_faturas_mensais()
RETURNS TABLE(faturas_geradas INTEGER, detalhes JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura RECORD;
  v_count INTEGER := 0;
  v_detalhes JSONB := '[]'::jsonb;
  v_numero TEXT;
  v_vencimento DATE;
  v_mes_ref TEXT;
BEGIN
  -- Se chamado por usuário autenticado (não cron), exigir super_admin
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super_admin pode gerar faturas manualmente';
  END IF;

  v_mes_ref := to_char(CURRENT_DATE, 'YYYY-MM');

  FOR v_assinatura IN
    SELECT a.*, t.nome AS tenant_nome
    FROM assinaturas a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE a.status IN ('ativa', 'trial')
      AND t.ativo = true
  LOOP
    v_vencimento := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      v_assinatura.dia_vencimento
    );

    IF EXISTS (
      SELECT 1 FROM faturas
      WHERE assinatura_id = v_assinatura.id
        AND to_char(data_emissao, 'YYYY-MM') = v_mes_ref
    ) THEN
      CONTINUE;
    END IF;

    v_numero := 'FAT-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' ||
                lpad((COALESCE((SELECT COUNT(*) FROM faturas
                                WHERE to_char(created_at, 'YYYY-MM') = v_mes_ref), 0) + 1)::text, 4, '0');

    INSERT INTO faturas (
      assinatura_id, tenant_id, numero, valor,
      data_emissao, data_vencimento, status
    ) VALUES (
      v_assinatura.id,
      v_assinatura.tenant_id,
      v_numero,
      v_assinatura.valor_contratado,
      CURRENT_DATE,
      v_vencimento,
      'pendente'
    );

    UPDATE assinaturas
    SET proxima_cobranca = v_vencimento + INTERVAL '1 month',
        updated_at = now()
    WHERE id = v_assinatura.id;

    v_count := v_count + 1;
    v_detalhes := v_detalhes || jsonb_build_object(
      'tenant', v_assinatura.tenant_nome,
      'numero', v_numero,
      'vencimento', v_vencimento,
      'valor', v_assinatura.valor_contratado
    );
  END LOOP;

  RETURN QUERY SELECT v_count, v_detalhes;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_inadimplencia()
RETURNS TABLE(avisos_enviados INTEGER, tenants_suspensos INTEGER, detalhes JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura RECORD;
  v_avisos INTEGER := 0;
  v_suspensos INTEGER := 0;
  v_detalhes JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super_admin pode processar inadimplência manualmente';
  END IF;

  UPDATE faturas
  SET status = 'vencida', updated_at = now()
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;

  FOR v_fatura IN
    SELECT f.*, t.nome AS tenant_nome,
           (CURRENT_DATE - f.data_vencimento) AS dias_atraso
    FROM faturas f
    JOIN tenants t ON t.id = f.tenant_id
    WHERE f.status = 'vencida'
      AND t.ativo = true
      AND t.data_suspensao IS NULL
      AND (CURRENT_DATE - f.data_vencimento) >= 7
  LOOP
    UPDATE tenants
    SET ativo = false,
        data_suspensao = CURRENT_DATE,
        motivo_suspensao = 'Inadimplência: fatura ' || v_fatura.numero ||
                          ' vencida há ' || v_fatura.dias_atraso || ' dias',
        updated_at = now()
    WHERE id = v_fatura.tenant_id;

    UPDATE assinaturas
    SET status = 'suspensa', updated_at = now()
    WHERE tenant_id = v_fatura.tenant_id;

    v_suspensos := v_suspensos + 1;
    v_detalhes := v_detalhes || jsonb_build_object(
      'tipo', 'suspensao',
      'tenant', v_fatura.tenant_nome,
      'fatura', v_fatura.numero,
      'dias_atraso', v_fatura.dias_atraso
    );
  END LOOP;

  SELECT COUNT(*) INTO v_avisos
  FROM faturas f
  JOIN tenants t ON t.id = f.tenant_id
  WHERE f.status = 'vencida'
    AND t.ativo = true
    AND (CURRENT_DATE - f.data_vencimento) BETWEEN 3 AND 6;

  RETURN QUERY SELECT v_avisos, v_suspensos, v_detalhes;
END;
$$;
