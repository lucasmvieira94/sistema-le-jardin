
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'outros',
  fornecedor text,
  valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente',
  forma_pagamento text,
  recorrente boolean NOT NULL DEFAULT false,
  frequencia_recorrencia text,
  observacoes text,
  anexo_url text,
  criado_por uuid,
  origem_recorrencia uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_pagar_status_chk CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  CONSTRAINT contas_pagar_categoria_chk CHECK (categoria IN ('fornecedor','folha_pagamento','agua','luz','internet','aluguel','manutencao','alimentacao','medicamentos','impostos','servicos','outros')),
  CONSTRAINT contas_pagar_freq_chk CHECK (frequencia_recorrencia IS NULL OR frequencia_recorrencia IN ('semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual'))
);

CREATE INDEX idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX idx_contas_pagar_data_venc ON public.contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_data_pag ON public.contas_pagar(data_pagamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated visualiza contas_pagar"
  ON public.contas_pagar FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated gerencia contas_pagar"
  ON public.contas_pagar FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_contas_pagar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_contas_pagar_updated_at
BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_contas_pagar_updated_at();

-- Auto-gerar próxima recorrência
CREATE OR REPLACE FUNCTION public.tg_contas_pagar_recorrencia()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_intervalo interval;
  v_nova_data date;
  v_existe int;
BEGIN
  IF NEW.status = 'pago'
     AND (OLD.status IS DISTINCT FROM 'pago')
     AND NEW.recorrente = true
     AND NEW.frequencia_recorrencia IS NOT NULL THEN

    v_intervalo := CASE NEW.frequencia_recorrencia
      WHEN 'semanal' THEN interval '7 days'
      WHEN 'quinzenal' THEN interval '15 days'
      WHEN 'mensal' THEN interval '1 month'
      WHEN 'bimestral' THEN interval '2 months'
      WHEN 'trimestral' THEN interval '3 months'
      WHEN 'semestral' THEN interval '6 months'
      WHEN 'anual' THEN interval '1 year'
    END;

    v_nova_data := (NEW.data_vencimento + v_intervalo)::date;

    -- evitar duplicação
    SELECT count(*) INTO v_existe
    FROM public.contas_pagar
    WHERE origem_recorrencia = NEW.id
      AND data_vencimento = v_nova_data;

    IF v_existe = 0 THEN
      INSERT INTO public.contas_pagar (
        tenant_id, descricao, categoria, fornecedor, valor,
        data_vencimento, status, recorrente, frequencia_recorrencia,
        observacoes, criado_por, origem_recorrencia
      ) VALUES (
        NEW.tenant_id, NEW.descricao, NEW.categoria, NEW.fornecedor, NEW.valor,
        v_nova_data, 'pendente', true, NEW.frequencia_recorrencia,
        NEW.observacoes, NEW.criado_por, NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_contas_pagar_recorrencia
AFTER UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_contas_pagar_recorrencia();

-- Função para marcar como atrasada (chamável via cron ou manualmente)
CREATE OR REPLACE FUNCTION public.marcar_contas_atrasadas()
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.contas_pagar
     SET status = 'atrasado'
   WHERE status = 'pendente'
     AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
