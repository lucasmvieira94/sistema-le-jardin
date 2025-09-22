-- Adicionar constraint única para alerta_id na tabela agendamentos_whatsapp
-- Isso corrige o erro "ON CONFLICT specification" nos triggers do WhatsApp

-- Primeiro, remover duplicatas se existirem (manter apenas o registro mais recente por alerta)
DELETE FROM public.agendamentos_whatsapp a USING public.agendamentos_whatsapp b 
WHERE a.id < b.id AND a.alerta_id = b.alerta_id;

-- Adicionar constraint única no alerta_id
ALTER TABLE public.agendamentos_whatsapp 
ADD CONSTRAINT agendamentos_whatsapp_alerta_id_unique UNIQUE (alerta_id);