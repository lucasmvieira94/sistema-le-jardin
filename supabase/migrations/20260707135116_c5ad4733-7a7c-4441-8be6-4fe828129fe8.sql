
CREATE TABLE public.folhas_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano SMALLINT NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  path TEXT NOT NULL,
  tamanho_bytes INTEGER,
  paginas SMALLINT,
  enviado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, funcionario_id, mes, ano)
);

CREATE INDEX idx_folhas_ponto_funcionario ON public.folhas_ponto(funcionario_id, ano DESC, mes DESC);
CREATE INDEX idx_folhas_ponto_tenant ON public.folhas_ponto(tenant_id, ano DESC, mes DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folhas_ponto TO authenticated;
GRANT ALL ON public.folhas_ponto TO service_role;

ALTER TABLE public.folhas_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated gerencia folhas_ponto"
  ON public.folhas_ponto FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_folhas_ponto_updated_at
  BEFORE UPDATE ON public.folhas_ponto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_minhas_folhas_ponto(p_funcionario_id UUID)
RETURNS TABLE (
  id UUID,
  mes SMALLINT,
  ano SMALLINT,
  path TEXT,
  paginas SMALLINT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.mes, f.ano, f.path, f.paginas, f.created_at
  FROM public.folhas_ponto f
  WHERE f.funcionario_id = p_funcionario_id
  ORDER BY f.ano DESC, f.mes DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_minhas_folhas_ponto(UUID) TO anon, authenticated;

CREATE POLICY "Auth gerencia folhas-ponto storage select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'folhas-ponto');

CREATE POLICY "Auth gerencia folhas-ponto storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'folhas-ponto');

CREATE POLICY "Auth gerencia folhas-ponto storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'folhas-ponto');

CREATE POLICY "Auth gerencia folhas-ponto storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'folhas-ponto');
