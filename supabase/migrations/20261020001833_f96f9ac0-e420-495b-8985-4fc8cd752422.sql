DO $$
DECLARE
  doc RECORD;
BEGIN
  FOR doc IN SELECT id FROM public.documentos_emitidos WHERE codigo_verificador IS NULL LOOP
    UPDATE public.documentos_emitidos
    SET codigo_verificador = public.gerar_codigo_verificador_documento()
    WHERE id = doc.id;
  END LOOP;
END $$;