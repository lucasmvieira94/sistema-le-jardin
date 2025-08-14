-- Migrate escalas table to support reusable templates
-- Add new columns for template functionality
ALTER TABLE public.escalas 
ADD COLUMN jornada_trabalho TEXT NOT NULL DEFAULT '40h_8h_segsex',
ADD COLUMN observacoes TEXT;

-- Remove dias_semana column as it's no longer needed for templates
ALTER TABLE public.escalas 
DROP COLUMN dias_semana;