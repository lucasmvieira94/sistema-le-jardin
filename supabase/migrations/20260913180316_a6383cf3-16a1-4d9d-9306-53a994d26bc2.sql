CREATE TABLE public.recibos_envios_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_emitidos(id) ON DELETE RESTRICT,
  numero_recibo text NOT NULL,
  destinatario_email text NOT NULL,
  destinatario_nome text,
  residente_nome text NOT NULL,
  pdf_sha256 text NOT NULL,
  nome_arquivo text NOT NULL,
  status text NOT NULL,
  provedor_id text,
  erro_detalhes text,
  enviado_por uuid,
  ip_origem text,
  user_agent text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recibos_envios_status_valido CHECK (status IN ('enviado', 'falhou')),
  CONSTRAINT recibos_envios_hash_valido CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$')
);

GRANT SELECT ON public.recibos_envios_auditoria TO authenticated;
GRANT ALL ON public.recibos_envios_auditoria TO service_role;

ALTER TABLE public.recibos_envios_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores consultam auditoria de recibos"
ON public.recibos_envios_auditoria
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX recibos_envios_documento_idx
ON public.recibos_envios_auditoria(documento_id, created_at DESC);

CREATE INDEX recibos_envios_destinatario_idx
ON public.recibos_envios_auditoria(destinatario_email, created_at DESC);

COMMENT ON TABLE public.recibos_envios_auditoria IS 'Trilha imutável de tentativas de envio de recibos por e-mail, sem armazenar o conteúdo do PDF.';