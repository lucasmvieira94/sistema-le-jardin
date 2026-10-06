CREATE OR REPLACE FUNCTION public.gerar_codigo_verificador_documento()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidato text;
BEGIN
  LOOP
    candidato := (10000000 + floor(random() * 90000000))::bigint::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.documentos_emitidos
      WHERE codigo_verificador = candidato
    );
  END LOOP;
  RETURN candidato;
END;
$$;

ALTER TABLE public.documentos_emitidos
  ADD COLUMN IF NOT EXISTS codigo_verificador text;

CREATE UNIQUE INDEX IF NOT EXISTS documentos_emitidos_codigo_verificador_uidx
  ON public.documentos_emitidos (codigo_verificador)
  WHERE codigo_verificador IS NOT NULL;

CREATE OR REPLACE FUNCTION public.atribuir_codigo_verificador_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_verificador IS NULL OR NEW.codigo_verificador !~ '^[0-9]{8}$' THEN
    NEW.codigo_verificador := public.gerar_codigo_verificador_documento();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documentos_emitidos_codigo_verificador_trigger ON public.documentos_emitidos;
CREATE TRIGGER documentos_emitidos_codigo_verificador_trigger
BEFORE INSERT ON public.documentos_emitidos
FOR EACH ROW
EXECUTE FUNCTION public.atribuir_codigo_verificador_documento();

REVOKE ALL ON FUNCTION public.gerar_codigo_verificador_documento() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atribuir_codigo_verificador_documento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_verificador_documento() TO service_role;
GRANT EXECUTE ON FUNCTION public.atribuir_codigo_verificador_documento() TO service_role;