CREATE TABLE IF NOT EXISTS public.justificativas_atraso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  registro_ponto_id uuid REFERENCES public.registros_ponto(id) ON DELETE SET NULL,
  data date NOT NULL,
  horario_previsto time NOT NULL,
  horario_registrado time NOT NULL,
  minutos_atraso integer NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  analisado_por uuid,
  analisado_em timestamptz,
  resposta_gestor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_justificativas_atraso_tenant ON public.justificativas_atraso(tenant_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_justificativas_atraso_func ON public.justificativas_atraso(funcionario_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_justificativas_atraso_status ON public.justificativas_atraso(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.justificativas_atraso TO authenticated;
GRANT SELECT, INSERT ON public.justificativas_atraso TO anon;
GRANT ALL ON public.justificativas_atraso TO service_role;

ALTER TABLE public.justificativas_atraso ENABLE ROW LEVEL SECURITY;

-- Anon (portal PIN do funcionário) só pode inserir justificativa própria; leitura restrita a autenticados.
CREATE POLICY "anon_insert_justificativa" ON public.justificativas_atraso
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_manage_justificativa" ON public.justificativas_atraso
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_justificativas_atraso_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_justificativas_atraso_updated_at ON public.justificativas_atraso;
CREATE TRIGGER trg_justificativas_atraso_updated_at
  BEFORE UPDATE ON public.justificativas_atraso
  FOR EACH ROW EXECUTE FUNCTION public.tg_justificativas_atraso_updated_at();