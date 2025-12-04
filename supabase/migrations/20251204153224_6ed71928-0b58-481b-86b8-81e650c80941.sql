-- Adicionar campo residente_id à tabela estoque_fraldas para estoque individualizado
ALTER TABLE public.estoque_fraldas 
ADD COLUMN residente_id uuid REFERENCES public.residentes(id);

-- Criar índice para melhorar performance de buscas por residente
CREATE INDEX idx_estoque_fraldas_residente_id ON public.estoque_fraldas(residente_id);