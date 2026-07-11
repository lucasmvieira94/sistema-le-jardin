
-- Policy anon para signed URL do bucket folhas-ponto (ignora se já existir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Anon leitura folhas-ponto storage'
  ) THEN
    CREATE POLICY "Anon leitura folhas-ponto storage"
      ON storage.objects FOR SELECT TO anon
      USING (bucket_id = 'folhas-ponto');
  END IF;
END $$;

ALTER TABLE public.folhas_ponto
  ADD COLUMN IF NOT EXISTS confirmado BOOLEAN,
  ADD COLUMN IF NOT EXISTS confirmado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_discordancia TEXT,
  ADD COLUMN IF NOT EXISTS confirmacao_ip TEXT,
  ADD COLUMN IF NOT EXISTS confirmacao_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS primeira_abertura_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS public.get_minhas_folhas_ponto(UUID);

CREATE OR REPLACE FUNCTION public.get_minhas_folhas_ponto(p_funcionario_id UUID)
RETURNS TABLE (
  id UUID,
  mes SMALLINT,
  ano SMALLINT,
  path TEXT,
  paginas SMALLINT,
  created_at TIMESTAMPTZ,
  confirmado BOOLEAN,
  confirmado_at TIMESTAMPTZ,
  motivo_discordancia TEXT,
  primeira_abertura_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.mes, f.ano, f.path, f.paginas, f.created_at,
         f.confirmado, f.confirmado_at, f.motivo_discordancia, f.primeira_abertura_at
  FROM public.folhas_ponto f
  WHERE f.funcionario_id = p_funcionario_id
  ORDER BY f.ano DESC, f.mes DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_minhas_folhas_ponto(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.marcar_abertura_folha_ponto(
  p_folha_id UUID,
  p_funcionario_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.folhas_ponto
     SET primeira_abertura_at = COALESCE(primeira_abertura_at, now())
   WHERE id = p_folha_id
     AND funcionario_id = p_funcionario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_abertura_folha_ponto(UUID, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_folha_ponto(
  p_folha_id UUID,
  p_funcionario_id UUID,
  p_concorda BOOLEAN,
  p_motivo TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  confirmado BOOLEAN,
  confirmado_at TIMESTAMPTZ,
  motivo_discordancia TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT p_concorda AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Motivo é obrigatório quando não há concordância';
  END IF;

  RETURN QUERY
  UPDATE public.folhas_ponto f
     SET confirmado = p_concorda,
         confirmado_at = now(),
         motivo_discordancia = CASE WHEN p_concorda THEN NULL ELSE p_motivo END,
         confirmacao_ip = p_ip,
         confirmacao_user_agent = p_user_agent,
         primeira_abertura_at = COALESCE(f.primeira_abertura_at, now())
   WHERE f.id = p_folha_id
     AND f.funcionario_id = p_funcionario_id
     AND f.confirmado IS NULL
  RETURNING f.id, f.confirmado, f.confirmado_at, f.motivo_discordancia;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folha de ponto já foi confirmada anteriormente ou não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_folha_ponto(UUID, UUID, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated;
