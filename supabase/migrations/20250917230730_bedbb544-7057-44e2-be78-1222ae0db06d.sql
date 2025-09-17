-- Adicionar campo registra_ponto na tabela funcionarios
ALTER TABLE public.funcionarios 
ADD COLUMN registra_ponto boolean NOT NULL DEFAULT true;

-- Atualizar comentário da tabela
COMMENT ON COLUMN public.funcionarios.registra_ponto IS 'Indica se o funcionário deve registrar ponto e ter escala de trabalho';