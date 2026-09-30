REVOKE EXECUTE ON FUNCTION public.monitorar_prontuarios_dia(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.impedir_encerramento_dia_corrente() FROM PUBLIC, anon, authenticated;