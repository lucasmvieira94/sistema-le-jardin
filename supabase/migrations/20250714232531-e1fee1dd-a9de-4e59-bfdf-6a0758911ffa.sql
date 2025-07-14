-- Adicionar campo de domínio de email nas configurações da empresa
ALTER TABLE public.configuracoes_empresa 
ADD COLUMN dominio_email TEXT DEFAULT 'no-reply@resend.dev';