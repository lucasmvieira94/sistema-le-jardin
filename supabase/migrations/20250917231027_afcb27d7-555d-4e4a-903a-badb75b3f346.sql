-- Permitir que escala_id seja nulo para funcionários que não registram ponto
ALTER TABLE public.funcionarios 
ALTER COLUMN escala_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.funcionarios.escala_id IS 'ID da escala de trabalho (opcional para funcionários que não registram ponto)';