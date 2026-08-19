-- =====================================================================
-- Assinatura digital com validade jurídica (MP 2.200-2/2001 art. 10 §2º,
-- Lei 14.063/2020 — assinatura eletrônica simples/avançada)
-- =====================================================================

-- 1) ENVELOPES -------------------------------------------------------
CREATE TABLE public.assinatura_envelopes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  referencia_id UUID,
  referencia_tabela TEXT,
  documento_emitido_id UUID REFERENCES public.documentos_emitidos(id) ON DELETE SET NULL,
  conteudo_html TEXT,
  arquivo_path TEXT,
  hash_documento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  mensagem TEXT,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assinatura_envelopes_status_chk
    CHECK (status IN ('rascunho','aguardando','parcial','concluido','recusado','cancelado','expirado')),
  CONSTRAINT assinatura_envelopes_tipo_chk
    CHECK (tipo IN ('contrato_residente','contrato_temporario','advertencia',
                    'folha_ponto','contracheque','recibo_pagamento','recibo_despesa','outro'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura_envelopes TO authenticated;
GRANT ALL ON public.assinatura_envelopes TO service_role;
ALTER TABLE public.assinatura_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios do tenant gerenciam envelopes"
  ON public.assinatura_envelopes FOR ALL TO authenticated
  USING (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
  WITH CHECK (tenant_id IS NULL OR public.has_tenant_access(tenant_id));

CREATE INDEX idx_assinatura_envelopes_tenant ON public.assinatura_envelopes(tenant_id, status);
CREATE INDEX idx_assinatura_envelopes_ref ON public.assinatura_envelopes(referencia_tabela, referencia_id);

-- 2) SIGNATÁRIOS -----------------------------------------------------
CREATE TABLE public.assinatura_signatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES public.assinatura_envelopes(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  papel TEXT NOT NULL DEFAULT 'cliente',
  metodo TEXT NOT NULL DEFAULT 'otp_email',
  ordem INTEGER NOT NULL DEFAULT 1,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  token_expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  status TEXT NOT NULL DEFAULT 'pendente',
  otp_hash TEXT,
  otp_expira_em TIMESTAMPTZ,
  otp_tentativas INTEGER NOT NULL DEFAULT 0,
  otp_enviado_em TIMESTAMPTZ,
  convite_enviado_em TIMESTAMPTZ,
  visualizado_em TIMESTAMPTZ,
  assinado_em TIMESTAMPTZ,
  recusado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  rubrica_base64 TEXT,
  hash_assinatura TEXT,
  ip_origem TEXT,
  user_agent TEXT,
  geolocalizacao JSONB,
  evidencias JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assinatura_signatarios_papel_chk
    CHECK (papel IN ('empresa','funcionario','cliente','responsavel','testemunha')),
  CONSTRAINT assinatura_signatarios_metodo_chk
    CHECK (metodo IN ('otp_email','otp_sms','biometria_facial','rubrica_empresa')),
  CONSTRAINT assinatura_signatarios_status_chk
    CHECK (status IN ('pendente','enviado','visualizado','assinado','recusado','expirado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura_signatarios TO authenticated;
GRANT ALL ON public.assinatura_signatarios TO service_role;
ALTER TABLE public.assinatura_signatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios do tenant gerenciam signatarios"
  ON public.assinatura_signatarios FOR ALL TO authenticated
  USING (tenant_id IS NULL OR public.has_tenant_access(tenant_id))
  WITH CHECK (tenant_id IS NULL OR public.has_tenant_access(tenant_id));

CREATE INDEX idx_assinatura_signatarios_envelope ON public.assinatura_signatarios(envelope_id, ordem);

-- 3) AUDITORIA -------------------------------------------------------
CREATE TABLE public.assinatura_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  envelope_id UUID NOT NULL REFERENCES public.assinatura_envelopes(id) ON DELETE CASCADE,
  signatario_id UUID REFERENCES public.assinatura_signatarios(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  ip_origem TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.assinatura_eventos TO authenticated;
GRANT ALL ON public.assinatura_eventos TO service_role;
ALTER TABLE public.assinatura_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios do tenant veem auditoria de assinatura"
  ON public.assinatura_eventos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assinatura_envelopes e
    WHERE e.id = assinatura_eventos.envelope_id
      AND (e.tenant_id IS NULL OR public.has_tenant_access(e.tenant_id))
  ));

CREATE INDEX idx_assinatura_eventos_envelope ON public.assinatura_eventos(envelope_id, created_at);

-- 4) TRIGGERS updated_at ---------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_assinatura_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assinatura_envelopes_updated
  BEFORE UPDATE ON public.assinatura_envelopes
  FOR EACH ROW EXECUTE FUNCTION public.tg_assinatura_updated_at();

CREATE TRIGGER trg_assinatura_signatarios_updated
  BEFORE UPDATE ON public.assinatura_signatarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_assinatura_updated_at();

-- 5) Recalcular status do envelope conforme os signatários ------------
CREATE OR REPLACE FUNCTION public.assinatura_recalcular_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_envelope UUID;
  v_total INT;
  v_assinados INT;
  v_recusados INT;
BEGIN
  v_envelope := COALESCE(NEW.envelope_id, OLD.envelope_id);

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'assinado'),
         COUNT(*) FILTER (WHERE status = 'recusado')
    INTO v_total, v_assinados, v_recusados
  FROM public.assinatura_signatarios
  WHERE envelope_id = v_envelope;

  UPDATE public.assinatura_envelopes
     SET status = CASE
           WHEN status IN ('cancelado','rascunho') THEN status
           WHEN v_recusados > 0 THEN 'recusado'
           WHEN v_total > 0 AND v_assinados = v_total THEN 'concluido'
           WHEN v_assinados > 0 THEN 'parcial'
           ELSE 'aguardando'
         END,
         concluido_em = CASE
           WHEN v_total > 0 AND v_assinados = v_total AND status NOT IN ('cancelado','rascunho')
             THEN COALESCE(concluido_em, now())
           ELSE concluido_em
         END
   WHERE id = v_envelope;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_assinatura_signatarios_status
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.assinatura_signatarios
  FOR EACH ROW EXECUTE FUNCTION public.assinatura_recalcular_status();

-- 6) Rubrica institucional na configuração da empresa -----------------
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS assinatura_empresa_base64 TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_empresa_nome TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_empresa_cargo TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_empresa_cpf TEXT;