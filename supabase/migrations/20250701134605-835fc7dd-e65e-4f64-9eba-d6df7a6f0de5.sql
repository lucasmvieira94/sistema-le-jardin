
-- Adicionar colunas de geolocalização à tabela registros_ponto
ALTER TABLE public.registros_ponto 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Adicionar comentários para documentar as colunas
COMMENT ON COLUMN public.registros_ponto.latitude IS 'Latitude da localização do registro de ponto';
COMMENT ON COLUMN public.registros_ponto.longitude IS 'Longitude da localização do registro de ponto';
