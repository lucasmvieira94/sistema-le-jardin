-- Tabela de lembretes dispensados/lidos por funcionário (controla snooze e visualização)
CREATE TABLE public.lembretes_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL,
  tipo_lembrete TEXT NOT NULL, -- 'ponto_entrada', 'ponto_intervalo_inicio', 'ponto_intervalo_fim', 'ponto_saida', 'prontuario_pendente', 'medicamento_horario'
  referencia_id TEXT, -- id do residente, prontuário ou medicamento associado
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'visualizado', 'concluido', 'dispensado'
  visualizado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lembretes_func_data ON public.lembretes_funcionario(funcionario_id, data_referencia);
CREATE INDEX idx_lembretes_status ON public.lembretes_funcionario(status, data_referencia);
CREATE UNIQUE INDEX uq_lembretes_unicos ON public.lembretes_funcionario(funcionario_id, tipo_lembrete, COALESCE(referencia_id, ''), data_referencia);

ALTER TABLE public.lembretes_funcionario ENABLE ROW LEVEL SECURITY;

-- Acesso anônimo (portal de funcionário usa code de 4 dígitos via anon role)
CREATE POLICY "Anon pode gerenciar lembretes"
ON public.lembretes_funcionario FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated podem gerenciar lembretes"
ON public.lembretes_funcionario FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_lembretes_funcionario_updated
BEFORE UPDATE ON public.lembretes_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de subscriptions push do funcionário (para web push)
CREATE TABLE public.push_subscriptions_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, endpoint)
);

ALTER TABLE public.push_subscriptions_funcionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon gerencia push subs"
ON public.push_subscriptions_funcionario FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "Auth gerencia push subs"
ON public.push_subscriptions_funcionario FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_push_subs_updated
BEFORE UPDATE ON public.push_subscriptions_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();