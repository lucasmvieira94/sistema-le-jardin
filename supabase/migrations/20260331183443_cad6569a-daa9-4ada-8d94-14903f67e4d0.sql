
-- Tabela para solicitações de contratos temporários (curta temporada)
CREATE TABLE public.solicitacoes_contrato_temporario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Dados do contratante (preenchidos pelo contratante via link público)
  contratante_nome TEXT,
  contratante_cpf VARCHAR,
  contratante_rg VARCHAR,
  contratante_endereco TEXT,
  contratante_cidade VARCHAR,
  contratante_estado VARCHAR,
  contratante_cep VARCHAR,
  contratante_telefone VARCHAR,
  contratante_email VARCHAR,
  
  -- Dados do residente (preenchidos pelo contratante)
  residente_nome TEXT,
  residente_cpf VARCHAR,
  residente_data_nascimento DATE,
  residente_observacoes TEXT,
  
  -- Dados financeiros (preenchidos pela empresa/admin)
  valor_mensalidade NUMERIC,
  dia_vencimento INTEGER,
  forma_pagamento TEXT DEFAULT 'boleto',
  data_inicio_contrato DATE,
  data_fim_contrato DATE,
  observacoes_empresa TEXT,
  
  -- Controle
  status VARCHAR NOT NULL DEFAULT 'aguardando_contratante',
  contrato_gerado_id UUID REFERENCES public.contratos_residentes(id),
  criado_por UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.solicitacoes_contrato_temporario ENABLE ROW LEVEL SECURITY;

-- Acesso público via token (contratante preenche sem autenticação)
CREATE POLICY "Acesso público por token" ON public.solicitacoes_contrato_temporario
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Admins gerenciam tudo
CREATE POLICY "Admins gerenciam solicitações" ON public.solicitacoes_contrato_temporario
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
