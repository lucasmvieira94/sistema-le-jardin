-- Adicionar coluna tenant_id na tabela user_roles
ALTER TABLE public.user_roles 
  ADD COLUMN tenant_id UUID;

-- Buscar o tenant padrão para backfill
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Atualizar todos os registros existentes com o tenant padrão
  UPDATE public.user_roles 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id IS NULL;
END $$;

-- Tornar coluna NOT NULL
ALTER TABLE public.user_roles 
  ALTER COLUMN tenant_id SET NOT NULL;

-- Adicionar foreign key e índice
ALTER TABLE public.user_roles 
  ADD CONSTRAINT fk_user_roles_tenant 
  FOREIGN KEY (tenant_id) 
  REFERENCES public.tenants(id) 
  ON DELETE CASCADE;

CREATE INDEX idx_user_roles_tenant_id 
  ON public.user_roles(tenant_id);

-- Criar índice composto para busca eficiente
CREATE INDEX idx_user_roles_user_tenant 
  ON public.user_roles(user_id, tenant_id);

-- Atualizar RLS da tabela user_roles para isolar por tenant
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;

CREATE POLICY "Usuários veem apenas roles do seu tenant"
  ON public.user_roles
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE id = current_setting('app.current_tenant_id', true)::uuid
      AND ativo = true
    )
  );

CREATE POLICY "Admins podem gerenciar roles do seu tenant"
  ON public.user_roles
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND has_role(auth.uid(), 'admin'::app_role)
  );

COMMENT ON COLUMN public.user_roles.tenant_id IS 'ID do tenant (empresa) ao qual o usuário pertence';