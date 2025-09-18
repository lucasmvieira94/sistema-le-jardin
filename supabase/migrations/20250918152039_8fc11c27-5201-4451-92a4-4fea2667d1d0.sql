-- Criar tabela para controle de temperatura da sala de medicamentos
CREATE TABLE public.controle_temperatura_medicamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  horario_medicao TIME WITHOUT TIME ZONE NOT NULL,
  temperatura NUMERIC(4,2) NOT NULL CHECK (temperatura >= 0 AND temperatura <= 50),
  periodo_dia CHARACTER VARYING(10) NOT NULL CHECK (periodo_dia IN ('manha', 'tarde', 'noite', 'madrugada')),
  conformidade BOOLEAN NOT NULL DEFAULT false,
  acoes_corretivas TEXT,
  funcionario_responsavel UUID REFERENCES funcionarios(id),
  nome_responsavel TEXT NOT NULL,
  localizacao_sala TEXT DEFAULT 'Sala de Medicamentos',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.controle_temperatura_medicamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Admins podem gerenciar controle de temperatura" 
ON public.controle_temperatura_medicamentos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem inserir registros de temperatura" 
ON public.controle_temperatura_medicamentos 
FOR INSERT 
WITH CHECK (funcionario_responsavel IN (
  SELECT id FROM funcionarios WHERE ativo = true
));

CREATE POLICY "Funcionários podem visualizar registros de temperatura" 
ON public.controle_temperatura_medicamentos 
FOR SELECT 
USING (funcionario_responsavel IN (
  SELECT id FROM funcionarios WHERE ativo = true
));

-- Trigger para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_temperatura_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER update_controle_temperatura_updated_at
  BEFORE UPDATE ON public.controle_temperatura_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_temperatura_updated_at();

-- Função para calcular conformidade automaticamente
CREATE OR REPLACE FUNCTION public.calcular_conformidade_temperatura()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular conformidade baseado na faixa 15°C - 30°C
  NEW.conformidade = (NEW.temperatura >= 15.0 AND NEW.temperatura <= 30.0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER calcular_conformidade_trigger
  BEFORE INSERT OR UPDATE ON public.controle_temperatura_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_conformidade_temperatura();

-- Índices para melhor performance
CREATE INDEX idx_controle_temperatura_data ON public.controle_temperatura_medicamentos(data_registro);
CREATE INDEX idx_controle_temperatura_funcionario ON public.controle_temperatura_medicamentos(funcionario_responsavel);
CREATE INDEX idx_controle_temperatura_conformidade ON public.controle_temperatura_medicamentos(conformidade);