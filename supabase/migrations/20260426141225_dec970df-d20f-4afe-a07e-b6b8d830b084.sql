
-- 1. Adicionar campos de suspensão em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS data_suspensao DATE,
  ADD COLUMN IF NOT EXISTS motivo_suspensao TEXT;

-- 2. Adicionar dia_vencimento em assinaturas
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER NOT NULL DEFAULT 10
    CHECK (dia_vencimento BETWEEN 1 AND 28);

-- 3. Função: gerar faturas mensais
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
  v_mes_ref := to_char(CURRENT_DATE, 'YYYY-MM');

  FOR v_assinatura IN
    SELECT a.*, t.nome AS tenant_nome
    FROM assinaturas a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE a.status IN ('ativa', 'trial')
      AND t.ativo = true
  LOOP
    -- Calcula vencimento do mês corrente
    v_vencimento := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      v_assinatura.dia_vencimento
    );

    -- Pula se já existe fatura desse mês para essa assinatura
    IF EXISTS (
      SELECT 1 FROM faturas
      WHERE assinatura_id = v_assinatura.id
        AND to_char(data_emissao, 'YYYY-MM') = v_mes_ref
    ) THEN
      CONTINUE;
    END IF;

    -- Gera número único: FAT-YYYYMM-XXXX
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

    -- Atualiza próxima cobrança da assinatura
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

-- 4. Função: processar inadimplência (aviso + suspensão)
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
  -- 1. Marcar faturas vencidas como 'vencida'
  UPDATE faturas
  SET status = 'vencida', updated_at = now()
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;

  -- 2. Suspender tenants com fatura vencida há 7+ dias
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

  -- 3. Contar avisos (faturas vencidas há 3 dias — registro para edge function de email enviar)
  SELECT COUNT(*) INTO v_avisos
  FROM faturas f
  JOIN tenants t ON t.id = f.tenant_id
  WHERE f.status = 'vencida'
    AND t.ativo = true
    AND (CURRENT_DATE - f.data_vencimento) BETWEEN 3 AND 6;

  RETURN QUERY SELECT v_avisos, v_suspensos, v_detalhes;
END;
$$;

-- 5. Trigger: reativar tenant ao pagar fatura
CREATE OR REPLACE FUNCTION public.reativar_tenant_apos_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paga' AND OLD.status IN ('vencida', 'pendente') THEN
    -- Verifica se ainda há outras faturas vencidas
    IF NOT EXISTS (
      SELECT 1 FROM faturas
      WHERE tenant_id = NEW.tenant_id
        AND status = 'vencida'
        AND id != NEW.id
    ) THEN
      UPDATE tenants
      SET ativo = true,
          data_suspensao = NULL,
          motivo_suspensao = NULL,
          updated_at = now()
      WHERE id = NEW.tenant_id AND ativo = false;

      UPDATE assinaturas
      SET status = 'ativa', updated_at = now()
      WHERE tenant_id = NEW.tenant_id AND status = 'suspensa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reativar_tenant_pagamento ON public.faturas;
CREATE TRIGGER trg_reativar_tenant_pagamento
  AFTER UPDATE ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.reativar_tenant_apos_pagamento();

-- 6. Cron jobs
-- Remover jobs antigos se existirem
SELECT cron.unschedule('gerar-faturas-mensais') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='gerar-faturas-mensais');
SELECT cron.unschedule('processar-inadimplencia') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='processar-inadimplencia');

-- Gerar faturas: todo dia 1 às 03:00 (06:00 UTC = 03:00 BRT)
SELECT cron.schedule(
  'gerar-faturas-mensais',
  '0 6 1 * *',
  $$ SELECT public.gerar_faturas_mensais(); $$
);

-- Processar inadimplência: todo dia às 06:00 BRT (09:00 UTC)
SELECT cron.schedule(
  'processar-inadimplencia',
  '0 9 * * *',
  $$ SELECT public.processar_inadimplencia(); $$
);
