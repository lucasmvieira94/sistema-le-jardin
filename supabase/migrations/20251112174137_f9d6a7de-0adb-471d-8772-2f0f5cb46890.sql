-- Adicionar campo marca na tabela estoque_fraldas
ALTER TABLE estoque_fraldas 
ADD COLUMN IF NOT EXISTS marca character varying;

-- Adicionar comentário para documentar os campos
COMMENT ON COLUMN estoque_fraldas.tipo_fralda IS 'Tipo de fralda: De Vestir ou Convencional';
COMMENT ON COLUMN estoque_fraldas.marca IS 'Marca da fralda: TENA, BIGFRAL, PLENITUD, COTIDIAN, BIOFRAL, MAXCLEAN, PROTEFRAL, DAUF, NEEDS, SENEXCONFORT, OUTRAS';