CREATE OR REPLACE FUNCTION public.encerrar_contratos_distratados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.contratos_residentes c
     SET status = 'encerrado'
   WHERE c.status <> 'encerrado'
     AND EXISTS (
       SELECT 1 FROM public.contratos_distratos d
        WHERE d.contrato_id = c.id
          AND d.data_efetiva <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.encerrar_contratos_distratados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_contratos_distratados() TO service_role;

SELECT cron.unschedule('encerrar-contratos-distratados')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'encerrar-contratos-distratados');
-- 03:05 UTC = 00:05 em Brasília
SELECT cron.schedule('encerrar-contratos-distratados', '5 3 * * *', $$SELECT public.encerrar_contratos_distratados();$$);

SELECT public.encerrar_contratos_distratados();