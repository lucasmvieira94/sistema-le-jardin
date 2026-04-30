-- Tabela de fichas de acolhimento
CREATE TABLE public.fichas_acolhimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  residente_id UUID NOT NULL,
  
  -- Token público
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  data_expiracao_token TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  
  -- Status: pendente | preenchida | aprovada
  status TEXT NOT NULL DEFAULT 'pendente',
  
  -- Preenchimento
  data_preenchimento TIMESTAMPTZ,
  data_aprovacao TIMESTAMPTZ,
  aprovado_por UUID,
  
  -- LGPD
  aceite_lgpd BOOLEAN NOT NULL DEFAULT false,
  data_aceite_lgpd TIMESTAMPTZ,
  ip_aceite TEXT,
  
  -- Identificação do responsável que preencheu
  preenchido_por_nome TEXT,
  preenchido_por_cpf TEXT,
  preenchido_por_parentesco TEXT,
  preenchido_por_telefone TEXT,
  
  -- Conteúdo (JSONB para flexibilidade)
  historico_saude JSONB DEFAULT '{}'::jsonb,
  habitos_rotina JSONB DEFAULT '{}'::jsonb,
  
  observacoes_admin TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT fichas_acolhimento_status_check CHECK (status IN ('pendente','preenchida','aprovada'))
);

CREATE INDEX idx_fichas_acolhimento_residente ON public.fichas_acolhimento(residente_id);
CREATE INDEX idx_fichas_acolhimento_token ON public.fichas_acolhimento(token);
CREATE INDEX idx_fichas_acolhimento_tenant ON public.fichas_acolhimento(tenant_id);

ALTER TABLE public.fichas_acolhimento ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins gerenciam fichas acolhimento"
ON public.fichas_acolhimento
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Funcionários autenticados podem ler
CREATE POLICY "Funcionarios visualizam fichas acolhimento"
ON public.fichas_acolhimento
FOR SELECT
TO authenticated
USING (true);

-- Acesso público (anon): SELECT apenas com token válido (validado no client + edge function)
CREATE POLICY "Anon le ficha por token"
ON public.fichas_acolhimento
FOR SELECT
TO anon
USING (data_expiracao_token > now());

-- Acesso público (anon): UPDATE apenas se status != 'aprovada' e token válido
CREATE POLICY "Anon atualiza ficha por token"
ON public.fichas_acolhimento
FOR UPDATE
TO anon
USING (data_expiracao_token > now() AND status <> 'aprovada')
WITH CHECK (data_expiracao_token > now() AND status <> 'aprovada');

-- Trigger updated_at
CREATE TRIGGER trg_fichas_acolhimento_updated_at
BEFORE UPDATE ON public.fichas_acolhimento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();