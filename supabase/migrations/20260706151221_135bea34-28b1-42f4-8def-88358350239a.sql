
-- Tabela de contracheques
CREATE TABLE public.contracheques (
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

CREATE INDEX idx_contracheques_funcionario ON public.contracheques(funcionario_id, ano DESC, mes DESC);
CREATE INDEX idx_contracheques_tenant ON public.contracheques(tenant_id, ano DESC, mes DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracheques TO authenticated;
GRANT ALL ON public.contracheques TO service_role;

ALTER TABLE public.contracheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated gerencia contracheques"
  ON public.contracheques FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_contracheques_updated_at
  BEFORE UPDATE ON public.contracheques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função pública para o funcionário (acesso via PIN, sem auth JWT)
CREATE OR REPLACE FUNCTION public.get_meus_contracheques(p_funcionario_id UUID)
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
  SELECT c.id, c.mes, c.ano, c.path, c.paginas, c.created_at
  FROM public.contracheques c
  WHERE c.funcionario_id = p_funcionario_id
  ORDER BY c.ano DESC, c.mes DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_meus_contracheques(UUID) TO anon, authenticated;

-- Função para gerar signed URL do contracheque para o funcionário (via PIN)
CREATE OR REPLACE FUNCTION public.get_contracheque_path(p_contracheque_id UUID, p_funcionario_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.path
  FROM public.contracheques c
  WHERE c.id = p_contracheque_id AND c.funcionario_id = p_funcionario_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_contracheque_path(UUID, UUID) TO anon, authenticated;

-- Policies do bucket 'contracheques' em storage.objects
CREATE POLICY "Auth gerencia contracheques storage select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracheques');

CREATE POLICY "Auth gerencia contracheques storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracheques');

CREATE POLICY "Auth gerencia contracheques storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contracheques');

CREATE POLICY "Auth gerencia contracheques storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracheques');
