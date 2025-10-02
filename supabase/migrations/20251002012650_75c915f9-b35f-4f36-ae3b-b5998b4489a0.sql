-- ============================================================================
-- MIGRATION: Multi-Tenancy - Criação da estrutura de tenants
-- Descrição: Adiciona suporte multi-tenant ao sistema com isolamento de dados
-- Autor: Sistema Le Jardin
-- Data: 2025-01-02
-- 
-- ROLLBACK PLAN:
-- 1. DROP das políticas RLS criadas
-- 2. DROP da função has_tenant_access
-- 3. DROP da tabela tenants
-- ============================================================================

-- Criar tabela central de tenants/empresas
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_code_hash TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cnpj VARCHAR(14) UNIQUE,
  endereco TEXT,
  logo_url TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por hash
CREATE INDEX idx_tenants_employer_code_hash ON public.tenants(employer_code_hash);
CREATE INDEX idx_tenants_ativo ON public.tenants(ativo) WHERE ativo = true;

-- Trigger para updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para armazenar tokens de rotação temporários
CREATE TABLE IF NOT EXISTS public.tenant_rotation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  old_code_hash TEXT NOT NULL,
  new_code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para limpeza de tokens expirados
CREATE INDEX idx_rotation_tokens_expires ON public.tenant_rotation_tokens(expires_at);

-- Função para verificar acesso ao tenant
CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = _tenant_id
      AND ativo = true
  )
$$;

-- Função para validar employer_code
CREATE OR REPLACE FUNCTION public.validate_employer_code(
  p_employer_code TEXT
)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_hash TEXT;
BEGIN
  -- Gerar hash do código fornecido
  code_hash := encode(digest(p_employer_code, 'sha256'), 'hex');
  
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
$$;

-- Função para rotacionar employer_code (apenas admins)
CREATE OR REPLACE FUNCTION public.rotate_employer_code(
  p_tenant_id UUID,
  p_old_code TEXT,
  p_new_code TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Gerar hashes
  old_hash := encode(digest(p_old_code, 'sha256'), 'hex');
  new_hash := encode(digest(p_new_code, 'sha256'), 'hex');
  
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
$$;

-- Função para limpar tokens expirados (executar via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rotation_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tenant_rotation_tokens
  WHERE expires_at < now();
END;
$$;

-- Habilitar RLS na tabela tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tenants
CREATE POLICY "Admins podem gerenciar tenants"
  ON public.tenants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários autenticados podem visualizar tenant ativo"
  ON public.tenants
  FOR SELECT
  USING (ativo = true AND auth.role() = 'authenticated');

-- RLS para rotation tokens (apenas admins)
ALTER TABLE public.tenant_rotation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins acessam rotation tokens"
  ON public.tenant_rotation_tokens
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Comentários para documentação
COMMENT ON TABLE public.tenants IS 'Tabela central de multi-tenancy - armazena dados de empresas/instituições';
COMMENT ON COLUMN public.tenants.employer_code_hash IS 'Hash SHA-256 do código de acesso da empresa (nunca armazenar em texto puro)';
COMMENT ON COLUMN public.tenants.config IS 'Configurações específicas do tenant (JSON)';
COMMENT ON FUNCTION public.validate_employer_code IS 'Valida employer_code e retorna dados do tenant se válido';
COMMENT ON FUNCTION public.rotate_employer_code IS 'Rotaciona o employer_code de um tenant (apenas admins)';

-- Inserir tenant padrão para sistema existente (exemplo)
-- ATENÇÃO: Gerar um employer_code seguro e único para produção
INSERT INTO public.tenants (
  employer_code_hash,
  nome,
  cnpj,
  endereco,
  ativo
) VALUES (
  encode(digest('LEJARDIN2025', 'sha256'), 'hex'), -- Exemplo: código "LEJARDIN2025"
  'Le Jardin - Sistema Principal',
  NULL,
  NULL,
  true
) ON CONFLICT (employer_code_hash) DO NOTHING;

-- Log de auditoria
INSERT INTO public.audit_log (
  user_id,
  tabela,
  operacao,
  dados_novos
) VALUES (
  auth.uid(),
  'tenants',
  'MIGRATION_MULTI_TENANCY',
  jsonb_build_object(
    'action', 'create_tenant_infrastructure',
    'timestamp', now()
  )
);