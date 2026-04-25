-- Tornar tenant_id opcional para suportar super_admin (sem vínculo a um tenant específico)
ALTER TABLE public.user_roles ALTER COLUMN tenant_id DROP NOT NULL;

-- Garantir integridade: tenant_id deve ser NULL apenas quando a role é super_admin
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS chk_user_roles_tenant_required;

ALTER TABLE public.user_roles
  ADD CONSTRAINT chk_user_roles_tenant_required
  CHECK (
    (role = 'super_admin'::app_role) OR (tenant_id IS NOT NULL)
  );

-- Inserir o papel super_admin (idempotente)
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT '1d1ef381-a151-4797-aada-e844d6f62660'::uuid, 'super_admin'::app_role, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '1d1ef381-a151-4797-aada-e844d6f62660'::uuid
    AND role = 'super_admin'::app_role
);