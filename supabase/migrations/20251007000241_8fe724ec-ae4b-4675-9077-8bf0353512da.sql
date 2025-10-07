-- Garantir que pgcrypto está habilitado
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recriar função com conversão correta usando convert_to()
CREATE OR REPLACE FUNCTION public.validate_employer_code(p_employer_code text)
RETURNS TABLE(tenant_id uuid, tenant_name text, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  code_hash TEXT;
BEGIN
  -- Gerar hash do código fornecido - usar convert_to para converter texto em bytea
  code_hash := encode(digest(convert_to(p_employer_code, 'UTF8'), 'sha256'), 'hex');
  
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

-- Também corrigir a função rotate_employer_code
CREATE OR REPLACE FUNCTION public.rotate_employer_code(
  p_tenant_id uuid,
  p_old_code text,
  p_new_code text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_hash TEXT;
  new_hash TEXT;
  current_hash TEXT;
BEGIN
  -- Verificar se usuário é admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY SELECT false, 'Acesso negado. Apenas administradores podem rotacionar códigos.';
    RETURN;
  END IF;
  
  -- Gerar hashes usando convert_to
  old_hash := encode(digest(convert_to(p_old_code, 'UTF8'), 'sha256'), 'hex');
  new_hash := encode(digest(convert_to(p_new_code, 'UTF8'), 'sha256'), 'hex');
  
  -- Verificar código antigo
  SELECT employer_code_hash INTO current_hash
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  IF current_hash IS NULL THEN
    RETURN QUERY SELECT false, 'Tenant não encontrado.';
    RETURN;
  END IF;
  
  IF current_hash != old_hash THEN
    RETURN QUERY SELECT false, 'Código antigo inválido.';
    RETURN;
  END IF;
  
  -- Registrar rotação
  INSERT INTO public.tenant_rotation_tokens (
    tenant_id,
    old_code_hash,
    new_code_hash,
    created_by
  ) VALUES (
    p_tenant_id,
    old_hash,
    new_hash,
    auth.uid()
  );
  
  -- Atualizar código
  UPDATE public.tenants
  SET employer_code_hash = new_hash,
      updated_at = now()
  WHERE id = p_tenant_id;
  
  RETURN QUERY SELECT true, 'Código rotacionado com sucesso. Todos os usuários precisarão usar o novo código.';
END;
$function$;