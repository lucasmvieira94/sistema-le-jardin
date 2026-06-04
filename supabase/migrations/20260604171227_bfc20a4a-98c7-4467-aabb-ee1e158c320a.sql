
CREATE OR REPLACE FUNCTION public.mensalidade_recalcular_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  -- valor_total é coluna GERADA, portanto é NULL em BEFORE triggers.
  -- Recalculamos manualmente a partir das colunas base.
  v_total := COALESCE(NEW.valor_mensalidade,0) + COALESCE(NEW.valor_extras,0) - COALESCE(NEW.valor_desconto,0);

  IF NEW.valor_pago >= v_total AND v_total > 0 THEN
    NEW.status := 'pago';
    IF NEW.data_pagamento IS NULL THEN NEW.data_pagamento := CURRENT_DATE; END IF;
  ELSIF NEW.valor_pago > 0 AND NEW.valor_pago < v_total THEN
    NEW.status := 'parcial';
  ELSIF NEW.valor_pago = 0 AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.valor_pago = 0 THEN
    NEW.status := 'pendente';
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: recalcular status das mensalidades existentes (exceto canceladas).
UPDATE public.mensalidades_residentes
SET status = CASE
  WHEN valor_pago >= valor_total AND valor_total > 0 THEN 'pago'
  WHEN valor_pago > 0 AND valor_pago < valor_total THEN 'parcial'
  WHEN valor_pago = 0 AND data_vencimento < CURRENT_DATE THEN 'vencido'
  ELSE 'pendente'
END,
data_pagamento = CASE
  WHEN valor_pago >= valor_total AND valor_total > 0 AND data_pagamento IS NULL THEN CURRENT_DATE
  ELSE data_pagamento
END
WHERE status <> 'cancelado';
