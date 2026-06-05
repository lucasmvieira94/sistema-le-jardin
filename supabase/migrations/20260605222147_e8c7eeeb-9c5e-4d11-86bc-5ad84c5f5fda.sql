ALTER TABLE public.lancamentos_financeiros DROP CONSTRAINT lancamentos_financeiros_tipo_check;
ALTER TABLE public.lancamentos_financeiros ADD CONSTRAINT lancamentos_financeiros_tipo_check CHECK (tipo = ANY (ARRAY['extra'::text, 'desconto'::text, 'servico_terceiros'::text, 'adicional_natalino'::text]));

CREATE OR REPLACE FUNCTION public.recalcular_extras_mensalidade()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  alvo UUID;
BEGIN
  alvo := COALESCE(NEW.mensalidade_id, OLD.mensalidade_id);
  IF alvo IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.mensalidades_residentes m
  SET
    valor_extras = COALESCE((
      SELECT SUM(l.valor)
      FROM public.lancamentos_financeiros l
      WHERE l.mensalidade_id = m.id AND l.tipo IN ('extra','servico_terceiros','adicional_natalino')
    ), 0),
    valor_desconto = COALESCE((
      SELECT SUM(l.valor)
      FROM public.lancamentos_financeiros l
      WHERE l.mensalidade_id = m.id AND l.tipo = 'desconto'
    ), 0)
  WHERE m.id = alvo;

  RETURN COALESCE(NEW, OLD);
END;
$function$;