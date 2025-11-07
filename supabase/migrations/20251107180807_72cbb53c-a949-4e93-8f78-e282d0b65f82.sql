-- Criar tabela para armazenar relatórios semanais gerados pela IA
CREATE TABLE IF NOT EXISTS public.relatorios_semanais_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  relatorio JSONB NOT NULL,
  resumo_executivo TEXT,
  total_prontuarios INTEGER DEFAULT 0,
  nao_conformidades_encontradas INTEGER DEFAULT 0,
  gerado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela para alertas de não conformidade
CREATE TABLE IF NOT EXISTS public.alertas_nao_conformidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  relatorio_id UUID REFERENCES public.relatorios_semanais_ia(id) ON DELETE CASCADE,
  residente_id UUID REFERENCES public.residentes(id) ON DELETE CASCADE,
  tipo_alerta VARCHAR(50) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  detalhes JSONB,
  data_ocorrencia DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  visualizado_por UUID,
  visualizado_em TIMESTAMPTZ,
  resolvido_por UUID,
  resolvido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_relatorios_semanais_tenant ON public.relatorios_semanais_ia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_semanais_datas ON public.relatorios_semanais_ia(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_alertas_nao_conformidade_tenant ON public.alertas_nao_conformidade(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertas_nao_conformidade_status ON public.alertas_nao_conformidade(status);
CREATE INDEX IF NOT EXISTS idx_alertas_nao_conformidade_tipo ON public.alertas_nao_conformidade(tipo_alerta);

-- Habilitar RLS
ALTER TABLE public.relatorios_semanais_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_nao_conformidade ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para relatórios semanais
CREATE POLICY "Admins podem gerenciar relatórios"
  ON public.relatorios_semanais_ia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar relatórios"
  ON public.relatorios_semanais_ia FOR SELECT
  USING (true);

-- Políticas RLS para alertas de não conformidade
CREATE POLICY "Admins podem gerenciar alertas de não conformidade"
  ON public.alertas_nao_conformidade FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar alertas"
  ON public.alertas_nao_conformidade FOR SELECT
  USING (true);

CREATE POLICY "Funcionários podem atualizar status de alertas"
  ON public.alertas_nao_conformidade FOR UPDATE
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_relatorios_ia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER update_relatorios_semanais_ia_updated_at
  BEFORE UPDATE ON public.relatorios_semanais_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_relatorios_ia_updated_at();

CREATE TRIGGER update_alertas_nao_conformidade_updated_at
  BEFORE UPDATE ON public.alertas_nao_conformidade
  FOR EACH ROW
  EXECUTE FUNCTION public.update_relatorios_ia_updated_at();