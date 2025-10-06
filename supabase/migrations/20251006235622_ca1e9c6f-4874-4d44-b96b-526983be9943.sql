-- Garantir que pgcrypto está habilitado
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recriar função com cast explícito para o algoritmo
CREATE OR REPLACE FUNCTION public.validate_employer_code(p_employer_code text)
RETURNS TABLE(tenant_id uuid, tenant_name text, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  code_hash TEXT;
BEGIN
  -- Gerar hash do código fornecido com cast explícito
  code_hash := encode(digest(p_employer_code, 'sha256'::text), 'hex');
  
  -- Buscar tenant correspondente
  RETURN QUERY
  SELECT 
    t.id,
    t.nome,
    true as valid
  FROM public.tenants t
  WHERE t.employer_code_hash = code_hash
    AND t.ativo = true
  LIMIT 1;
  
  -- Se não encontrou, retornar inválido
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
  END IF;
END;
$function$;