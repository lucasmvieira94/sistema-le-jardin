DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.gerar_folha_ponto_mensal'::regproc) INTO d;
  d := replace(d, 'tem_escala := er IS NOT NULL;', 'tem_escala := vig.escala_id IS NOT NULL AND er.escala_nome IS NOT NULL;');
  EXECUTE d;
END $mig$;