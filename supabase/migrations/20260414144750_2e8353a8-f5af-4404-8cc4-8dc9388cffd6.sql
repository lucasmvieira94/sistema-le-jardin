
-- Alterar o default de consumo_medio_diario para 4
ALTER TABLE public.estoque_fraldas 
ALTER COLUMN consumo_medio_diario SET DEFAULT 4;

-- Atualizar registros existentes com valor 0 ou null
UPDATE public.estoque_fraldas 
SET consumo_medio_diario = 4 
WHERE consumo_medio_diario IS NULL OR consumo_medio_diario = 0;
