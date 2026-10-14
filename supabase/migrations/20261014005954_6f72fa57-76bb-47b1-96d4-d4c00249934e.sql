CREATE TABLE public.erros_envio_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,
  erro text NOT NULL,
  contexto jsonb NOT NULL DEFAULT '{}',
  diagnostico text,
  sugestao text,
  gravidade text,
  enviado_suporte boolean NOT NULL DEFAULT false,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erros_envio_suporte TO authenticated;
GRANT ALL ON public.erros_envio_suporte TO service_role;
ALTER TABLE public.erros_envio_suporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem erros de envio" ON public.erros_envio_suporte FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));