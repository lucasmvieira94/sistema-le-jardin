
-- ============================================
-- MÓDULO FINANCEIRO - MENSALIDADES DE RESIDENTES
-- ============================================

-- 1) Tabela de mensalidades (cobranças mensais por residente)
CREATE TABLE public.mensalidades_residentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  residente_id UUID NOT NULL,
  contrato_id UUID,
  competencia DATE NOT NULL, -- primeiro dia do mês de referência
  data_vencimento DATE NOT NULL,
  valor_mensalidade NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_extras NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL GENERATED ALWAYS AS
    (valor_mensalidade + valor_extras - valor_desconto) STORED,
  valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago','parcial','vencido','cancelado')),
  data_pagamento DATE,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix','boleto','dinheiro') OR forma_pagamento IS NULL),
  observacoes TEXT,
  gerado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (residente_id, competencia)
);

CREATE INDEX idx_mens_residente ON public.mensalidades_residentes(residente_id);
CREATE INDEX idx_mens_status ON public.mensalidades_residentes(status);
CREATE INDEX idx_mens_vencimento ON public.mensalidades_residentes(data_vencimento);
CREATE INDEX idx_mens_tenant ON public.mensalidades_residentes(tenant_id);

ALTER TABLE public.mensalidades_residentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam mensalidades"
  ON public.mensalidades_residentes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated visualiza mensalidades"
  ON public.mensalidades_residentes FOR SELECT
  TO authenticated
  USING (true);

-- 2) Tabela de lançamentos extras (serviços, compras avulsas)
CREATE TABLE public.lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  residente_id UUID NOT NULL,
  mensalidade_id UUID REFERENCES public.mensalidades_residentes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'extra'
    CHECK (tipo IN ('extra','desconto','servico_terceiros')),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  competencia DATE NOT NULL, -- mês ao qual o lançamento se aplica
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lanc_residente ON public.lancamentos_financeiros(residente_id);
CREATE INDEX idx_lanc_competencia ON public.lancamentos_financeiros(competencia);
CREATE INDEX idx_lanc_mensalidade ON public.lancamentos_financeiros(mensalidade_id);

ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam lancamentos"
  ON public.lancamentos_financeiros FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated visualiza lancamentos"
  ON public.lancamentos_financeiros FOR SELECT
  TO authenticated
  USING (true);

-- 3) Trigger: updated_at
CREATE TRIGGER trg_mens_updated
  BEFORE UPDATE ON public.mensalidades_residentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lanc_updated
  BEFORE UPDATE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger: marcar mensalidade vencida automaticamente em UPDATE/SELECT é caro;
--    melhor uma função que cliente roda. Mas vamos garantir status quando paga.
CREATE OR REPLACE FUNCTION public.mensalidade_recalcular_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  IF NEW.valor_pago >= NEW.valor_total AND NEW.valor_total > 0 THEN
    NEW.status := 'pago';
    IF NEW.data_pagamento IS NULL THEN NEW.data_pagamento := CURRENT_DATE; END IF;
  ELSIF NEW.valor_pago > 0 AND NEW.valor_pago < NEW.valor_total THEN
    NEW.status := 'parcial';
  ELSIF NEW.valor_pago = 0 AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.valor_pago = 0 THEN
    NEW.status := 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mens_status
  BEFORE INSERT OR UPDATE ON public.mensalidades_residentes
  FOR EACH ROW EXECUTE FUNCTION public.mensalidade_recalcular_status();

-- 5) Trigger: ao inserir/atualizar lançamento, recalcular valor_extras da mensalidade vinculada
CREATE OR REPLACE FUNCTION public.recalcular_extras_mensalidade()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  alvo UUID;
BEGIN
  alvo := COALESCE(NEW.mensalidade_id, OLD.mensalidade_id);
  IF alvo IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.mensalidades_residentes m
  SET
    valor_extras = COALESCE((
      SELECT SUM(CASE WHEN l.tipo = 'desconto' THEN 0 ELSE l.valor END)
      FROM public.lancamentos_financeiros l
      WHERE l.mensalidade_id = m.id AND l.tipo IN ('extra','servico_terceiros')
    ), 0),
    valor_desconto = COALESCE((
      SELECT SUM(l.valor)
      FROM public.lancamentos_financeiros l
      WHERE l.mensalidade_id = m.id AND l.tipo = 'desconto'
    ), 0)
  WHERE m.id = alvo;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_lanc_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_extras_mensalidade();

-- 6) Função para gerar mensalidades do mês corrente para todos os residentes ativos com contrato
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_mes(
  p_competencia DATE DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE(criadas INTEGER, ja_existentes INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_criadas INTEGER := 0;
  v_existentes INTEGER := 0;
  r RECORD;
  v_venc DATE;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (c.residente_id)
      c.id AS contrato_id,
      c.residente_id,
      c.tenant_id,
      c.valor_mensalidade,
      c.dia_vencimento
    FROM public.contratos_residentes c
    INNER JOIN public.residentes res ON res.id = c.residente_id
    WHERE c.status = 'ativo'
      AND res.ativo = true
      AND c.data_inicio_contrato <= (p_competencia + INTERVAL '1 month - 1 day')::date
      AND (c.data_fim_contrato IS NULL OR c.data_fim_contrato >= p_competencia)
    ORDER BY c.residente_id, c.data_inicio_contrato DESC
  LOOP
    v_venc := make_date(
      EXTRACT(YEAR FROM p_competencia)::int,
      EXTRACT(MONTH FROM p_competencia)::int,
      LEAST(GREATEST(COALESCE(r.dia_vencimento,10),1),
            EXTRACT(DAY FROM (p_competencia + INTERVAL '1 month - 1 day'))::int)
    );

    BEGIN
      INSERT INTO public.mensalidades_residentes
        (tenant_id, residente_id, contrato_id, competencia, data_vencimento,
         valor_mensalidade, gerado_automaticamente)
      VALUES
        (r.tenant_id, r.residente_id, r.contrato_id, p_competencia, v_venc,
         COALESCE(r.valor_mensalidade,0), true);
      v_criadas := v_criadas + 1;
    EXCEPTION WHEN unique_violation THEN
      v_existentes := v_existentes + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_criadas, v_existentes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_mensalidades_mes(DATE) TO authenticated;
