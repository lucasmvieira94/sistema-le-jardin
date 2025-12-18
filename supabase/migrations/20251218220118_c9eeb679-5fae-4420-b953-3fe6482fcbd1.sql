-- Adicionar campos de CPF e endereço do responsável na tabela de residentes
ALTER TABLE public.residentes 
ADD COLUMN IF NOT EXISTS responsavel_cpf TEXT,
ADD COLUMN IF NOT EXISTS responsavel_endereco TEXT;