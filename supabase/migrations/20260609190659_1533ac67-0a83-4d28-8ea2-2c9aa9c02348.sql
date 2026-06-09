
-- Configurações
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS cobrar_juros_multa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS multa_atraso_percentual numeric(5,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS juros_mora_mensal_percentual numeric(5,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS dias_carencia_atraso integer NOT NULL DEFAULT 0;

-- Mensalidades: valores cobrados de multa/juros no recebimento
ALTER TABLE public.mensalidades_residentes
  ADD COLUMN IF NOT EXISTS valor_multa numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros numeric(12,2) NOT NULL DEFAULT 0;

-- Recalcular valor_total considerando multa + juros
-- (mantém compatibilidade com geração existente: extras - desconto + multa + juros)
CREATE OR REPLACE FUNCTION public.tg_mensalidade_calcular_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.valor_mensalidade,0)
                   + COALESCE(NEW.valor_extras,0)
                   - COALESCE(NEW.valor_desconto,0)
                   + COALESCE(NEW.valor_multa,0)
                   + COALESCE(NEW.valor_juros,0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensalidade_calcular_total ON public.mensalidades_residentes;
CREATE TRIGGER trg_mensalidade_calcular_total
BEFORE INSERT OR UPDATE ON public.mensalidades_residentes
FOR EACH ROW EXECUTE FUNCTION public.tg_mensalidade_calcular_total();
