
-- Super admin pode ver e editar qualquer tenant
CREATE POLICY "Super admins veem todos os tenants"
  ON public.tenants FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins atualizam tenants"
  ON public.tenants FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Super admin pode gerenciar configuracoes_empresa de qualquer tenant
CREATE POLICY "Super admins gerenciam configuracoes_empresa"
  ON public.configuracoes_empresa FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
