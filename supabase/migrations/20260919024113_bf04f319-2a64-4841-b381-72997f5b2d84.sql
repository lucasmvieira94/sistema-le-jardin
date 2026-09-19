CREATE OR REPLACE FUNCTION public.validar_acesso_funcionario(p_codigo character)
RETURNS TABLE(
  funcionario_id uuid,
  nome_completo text,
  valid boolean,
  registra_ponto boolean,
  acesso_supervisor boolean,
  exigir_biometria boolean,
  biometria_facial jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    true,
    COALESCE(f.registra_ponto, true),
    COALESCE(f.acesso_supervisor, false),
    COALESCE(f.exigir_biometria, true),
    f.biometria_facial
  FROM public.funcionarios AS f
  WHERE f.codigo_4_digitos = p_codigo
    AND f.ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::text,
      false,
      true,
      false,
      true,
      NULL::jsonb;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.validar_acesso_funcionario(character) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_acesso_funcionario(character) TO anon, authenticated, service_role;