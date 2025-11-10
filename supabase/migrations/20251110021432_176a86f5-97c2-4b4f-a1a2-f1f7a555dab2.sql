-- Tabela para configurações de agendamento de relatórios
CREATE TABLE IF NOT EXISTS public.agendamentos_relatorios_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
  hora TIME NOT NULL DEFAULT '08:00:00',
  periodo_dias INTEGER NOT NULL DEFAULT 7, -- período em dias para análise
  email_destinatario TEXT NOT NULL,
  nome_destinatario TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, dia_semana)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agendamentos_relatorios_tenant ON public.agendamentos_relatorios_ia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_relatorios_ativo ON public.agendamentos_relatorios_ia(ativo);

-- RLS Policies
ALTER TABLE public.agendamentos_relatorios_ia ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados podem ver seus agendamentos
CREATE POLICY "Usuários podem ver agendamentos do seu tenant"
  ON public.agendamentos_relatorios_ia
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = agendamentos_relatorios_ia.tenant_id
    )
  );

-- Apenas admins podem criar agendamentos
CREATE POLICY "Admins podem criar agendamentos"
  ON public.agendamentos_relatorios_ia
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = agendamentos_relatorios_ia.tenant_id
      AND ur.role = 'admin'
    )
  );

-- Apenas admins podem atualizar agendamentos
CREATE POLICY "Admins podem atualizar agendamentos"
  ON public.agendamentos_relatorios_ia
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = agendamentos_relatorios_ia.tenant_id
      AND ur.role = 'admin'
    )
  );

-- Apenas admins podem deletar agendamentos
CREATE POLICY "Admins podem deletar agendamentos"
  ON public.agendamentos_relatorios_ia
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = agendamentos_relatorios_ia.tenant_id
      AND ur.role = 'admin'
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agendamentos_relatorios_updated_at
  BEFORE UPDATE ON public.agendamentos_relatorios_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.agendamentos_relatorios_ia IS 'Configurações de agendamento automático para geração de relatórios com IA';
COMMENT ON COLUMN public.agendamentos_relatorios_ia.dia_semana IS '0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado';
COMMENT ON COLUMN public.agendamentos_relatorios_ia.periodo_dias IS 'Número de dias para análise retroativa (padrão: 7 dias)';