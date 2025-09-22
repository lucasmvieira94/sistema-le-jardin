-- Adicionar constraint única para ip_address na tabela registro_tentativas
-- Isso corrige o erro "ON CONFLICT specification" nas funções que usam ON CONFLICT (ip_address)

-- Primeiro, remover duplicatas se existirem (manter apenas o registro mais recente por IP)
DELETE FROM public.registro_tentativas a USING public.registro_tentativas b 
WHERE a.id < b.id AND a.ip_address = b.ip_address;

-- Adicionar constraint única no ip_address
ALTER TABLE public.registro_tentativas 
ADD CONSTRAINT registro_tentativas_ip_address_unique UNIQUE (ip_address);