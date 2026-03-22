-- Add verification hash column for document integrity (LGPD compliance)
ALTER TABLE public.advertencias_suspensoes
ADD COLUMN hash_verificacao text;

-- Create function to generate hash on insert/update
CREATE OR REPLACE FUNCTION public.gerar_hash_advertencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.hash_verificacao := encode(
    sha256(
      convert_to(
        NEW.id::text || '|' ||
        NEW.funcionario_id::text || '|' ||
        NEW.tipo || '|' ||
        NEW.motivo || '|' ||
        NEW.descricao || '|' ||
        NEW.data_ocorrencia::text || '|' ||
        COALESCE(NEW.dias_suspensao::text, '') || '|' ||
        NEW.created_at::text,
        'UTF8'
      )
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate hash
CREATE TRIGGER trg_gerar_hash_advertencia
BEFORE INSERT OR UPDATE ON public.advertencias_suspensoes
FOR EACH ROW
EXECUTE FUNCTION public.gerar_hash_advertencia();

-- Generate hashes for existing records
UPDATE public.advertencias_suspensoes SET updated_at = now();