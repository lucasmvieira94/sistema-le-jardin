
ALTER TYPE documento_tipo ADD VALUE IF NOT EXISTS 'recibo_despesa';

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS beneficiario_nome text,
  ADD COLUMN IF NOT EXISTS beneficiario_documento text;
