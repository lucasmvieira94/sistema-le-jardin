-- Permitir que data_inicio_vigencia seja nulo para funcionários que não registram ponto
ALTER TABLE public.funcionarios 
ALTER COLUMN data_inicio_vigencia DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.funcionarios.data_inicio_vigencia IS 'Data de início da vigência da escala (opcional para funcionários que não registram ponto)';