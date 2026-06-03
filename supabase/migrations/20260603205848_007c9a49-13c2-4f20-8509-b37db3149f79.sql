
-- ENUM para tipo de documento
DO $$ BEGIN
  CREATE TYPE public.documento_tipo AS ENUM ('contrato_residente','contrato_temporario','advertencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.documento_acao AS ENUM ('gerado','reemitido','visualizado','verificado_publico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABELA: documentos_emitidos
CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.documento_tipo NOT NULL,
  referencia_id uuid,
  referencia_tabela text,
  numero_documento text,
  titular_nome text NOT NULL,
  hash_sha256 text NOT NULL UNIQUE,
  dados_estruturais jsonb NOT NULL DEFAULT '{}'::jsonb,
  emitido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_emitidos_hash ON public.documentos_emitidos(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_documentos_emitidos_ref ON public.documentos_emitidos(referencia_id);
CREATE INDEX IF NOT EXISTS idx_documentos_emitidos_tenant ON public.documentos_emitidos(tenant_id);

GRANT SELECT, INSERT ON public.documentos_emitidos TO authenticated;
GRANT ALL ON public.documentos_emitidos TO service_role;

ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users select same tenant"
  ON public.documentos_emitidos FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.get_current_tenant_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "auth users insert own"
  ON public.documentos_emitidos FOR INSERT TO authenticated
  WITH CHECK (
    emitido_por = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.get_current_tenant_id())
  );

-- TABELA: documentos_auditoria
CREATE TABLE IF NOT EXISTS public.documentos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_emitidos(id) ON DELETE CASCADE,
  acao public.documento_acao NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_origem text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_auditoria_doc ON public.documentos_auditoria(documento_id);
CREATE INDEX IF NOT EXISTS idx_documentos_auditoria_created ON public.documentos_auditoria(created_at DESC);

GRANT SELECT ON public.documentos_auditoria TO authenticated;
GRANT ALL ON public.documentos_auditoria TO service_role;

ALTER TABLE public.documentos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit"
  ON public.documentos_auditoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
