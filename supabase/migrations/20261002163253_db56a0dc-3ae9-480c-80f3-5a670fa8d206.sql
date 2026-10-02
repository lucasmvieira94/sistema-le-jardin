CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
REVOKE EXECUTE ON FUNCTION public.escala_vigente_em(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_escala_no_historico() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exigir_admin_escala() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escala_vigente_em(uuid, date) TO service_role;