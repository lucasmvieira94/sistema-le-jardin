ALTER TABLE public.erros_envio_suporte
  ADD COLUMN IF NOT EXISTS resolvido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolvido_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvido_por uuid,
  ADD COLUMN IF NOT EXISTS observacao_resolucao text;
GRANT SELECT, UPDATE ON public.erros_envio_suporte TO authenticated;
GRANT ALL ON public.erros_envio_suporte TO service_role;
CREATE POLICY "Admins resolvem erros" ON public.erros_envio_suporte FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_erros_suporte_created ON public.erros_envio_suporte(created_at DESC);