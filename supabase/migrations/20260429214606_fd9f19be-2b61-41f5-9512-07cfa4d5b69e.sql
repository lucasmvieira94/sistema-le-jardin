ALTER TABLE public.funcionarios 
ADD COLUMN IF NOT EXISTS recebe_vale_transporte boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS valor_diaria_vale_transporte numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN public.funcionarios.recebe_vale_transporte IS 'Indica se o funcionário recebe vale-transporte';
COMMENT ON COLUMN public.funcionarios.valor_diaria_vale_transporte IS 'Valor da diária de vale-transporte (opcional, para cálculo do total)';