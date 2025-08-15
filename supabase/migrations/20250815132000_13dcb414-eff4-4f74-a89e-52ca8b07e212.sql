-- Criar tabela para residentes
CREATE TABLE public.residentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  numero_prontuario VARCHAR(20) UNIQUE NOT NULL,
  quarto VARCHAR(10),
  responsavel_nome TEXT,
  responsavel_telefone VARCHAR(20),
  responsavel_email TEXT,
  condicoes_medicas TEXT,
  observacoes_gerais TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para registros do prontuário
CREATE TABLE public.prontuario_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id UUID NOT NULL REFERENCES public.residentes(id),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id),
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  horario_registro TIME NOT NULL DEFAULT CURRENT_TIME,
  tipo_registro VARCHAR(50) NOT NULL, -- 'atividade', 'medicacao', 'alimentacao', 'observacao', etc.
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para templates de atividades
CREATE TABLE public.atividades_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria VARCHAR(50) NOT NULL, -- 'cuidados_pessoais', 'medicacao', 'alimentacao', 'fisioterapia', etc.
  periodicidade VARCHAR(50), -- 'diaria', 'semanal', 'conforme_necessario'
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir alguns templates padrão
INSERT INTO public.atividades_templates (nome, descricao, categoria, periodicidade) VALUES
('Higiene matinal', 'Auxílio com banho e higiene pessoal matinal', 'cuidados_pessoais', 'diaria'),
('Medicação matinal', 'Administração de medicamentos prescritos para o período da manhã', 'medicacao', 'diaria'),
('Café da manhã', 'Auxílio com alimentação - café da manhã', 'alimentacao', 'diaria'),
('Almoço', 'Auxílio com alimentação - almoço', 'alimentacao', 'diaria'),
('Jantar', 'Auxílio com alimentação - jantar', 'alimentacao', 'diaria'),
('Medicação vespertina', 'Administração de medicamentos prescritos para o período da tarde', 'medicacao', 'diaria'),
('Medicação noturna', 'Administração de medicamentos prescritos para o período da noite', 'medicacao', 'diaria'),
('Exercícios físicos', 'Atividade física supervisionada', 'fisioterapia', 'diaria'),
('Aferição de sinais vitais', 'Medição de pressão arterial, temperatura e outros sinais vitais', 'cuidados_medicos', 'diaria'),
('Atividade recreativa', 'Participação em atividades de entretenimento e socialização', 'recreacao', 'diaria');

-- Enable RLS
ALTER TABLE public.residentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuario_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para residentes
CREATE POLICY "Admins can manage residentes" 
ON public.residentes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar residentes ativos" 
ON public.residentes 
FOR SELECT 
USING (ativo = true);

-- Políticas para prontuário
CREATE POLICY "Admins can manage prontuario_registros" 
ON public.prontuario_registros 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem inserir registros" 
ON public.prontuario_registros 
FOR INSERT 
WITH CHECK (funcionario_id IN (
  SELECT id FROM public.funcionarios WHERE ativo = true
));

CREATE POLICY "Funcionários podem visualizar todos os registros" 
ON public.prontuario_registros 
FOR SELECT 
USING (funcionario_id IN (
  SELECT id FROM public.funcionarios WHERE ativo = true
));

CREATE POLICY "Funcionários podem atualizar seus registros" 
ON public.prontuario_registros 
FOR UPDATE 
USING (funcionario_id IN (
  SELECT id FROM public.funcionarios WHERE ativo = true
));

-- Políticas para templates
CREATE POLICY "Todos podem visualizar templates ativos" 
ON public.atividades_templates 
FOR SELECT 
USING (ativo = true);

CREATE POLICY "Admins can manage templates" 
ON public.atividades_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));