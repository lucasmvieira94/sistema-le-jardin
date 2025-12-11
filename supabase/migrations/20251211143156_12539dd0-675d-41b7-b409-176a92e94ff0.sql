-- Criar tabela de contratos de prestação de serviço
CREATE TABLE public.contratos_residentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  
  -- Informações financeiras
  valor_mensalidade NUMERIC(10,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  forma_pagamento TEXT NOT NULL DEFAULT 'boleto',
  
  -- Datas do contrato
  data_inicio_contrato DATE NOT NULL,
  data_fim_contrato DATE,
  
  -- Informações adicionais do contratante (responsável financeiro)
  contratante_nome TEXT NOT NULL,
  contratante_cpf VARCHAR(14),
  contratante_rg VARCHAR(20),
  contratante_endereco TEXT,
  contratante_cidade VARCHAR(100),
  contratante_estado VARCHAR(2),
  contratante_cep VARCHAR(10),
  contratante_telefone VARCHAR(20),
  contratante_email VARCHAR(255),
  
  -- Serviços inclusos
  servicos_inclusos TEXT[],
  servicos_adicionais TEXT,
  
  -- Termos e observações
  clausulas_especiais TEXT,
  observacoes TEXT,
  
  -- Status do contrato
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'encerrado', 'pendente')),
  
  -- Controle
  numero_contrato VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.contratos_residentes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Admins podem gerenciar contratos"
ON public.contratos_residentes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar contratos"
ON public.contratos_residentes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM funcionarios WHERE funcionarios.ativo = true
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contratos_residentes_updated_at
BEFORE UPDATE ON public.contratos_residentes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_contratos_residente_id ON public.contratos_residentes(residente_id);
CREATE INDEX idx_contratos_status ON public.contratos_residentes(status);
CREATE INDEX idx_contratos_numero ON public.contratos_residentes(numero_contrato);