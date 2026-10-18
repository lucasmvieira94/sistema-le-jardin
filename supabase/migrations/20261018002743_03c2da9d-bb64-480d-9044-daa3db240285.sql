ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'distrato_residente';

CREATE TABLE public.contratos_distratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_residentes(id) ON DELETE CASCADE,
  residente_id uuid NOT NULL,
  tenant_id uuid,
  numero_distrato text NOT NULL,
  tipo_rescisao text NOT NULL,
  parte_iniciadora text NOT NULL DEFAULT 'contratante',
  data_distrato date NOT NULL,
  data_efetiva date NOT NULL,
  valor_proporcional numeric NOT NULL DEFAULT 0,
  valor_indenizacao numeric NOT NULL DEFAULT 0,
  valor_adaptacao numeric NOT NULL DEFAULT 0,
  valor_pendencias numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  retem_garantia boolean NOT NULL DEFAULT false,
  condicao_livre text,
  valores_pendentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_distratos_contrato ON public.contratos_distratos(contrato_id);

GRANT SELECT, INSERT, UPDATE ON public.contratos_distratos TO authenticated;
GRANT ALL ON public.contratos_distratos TO service_role;

ALTER TABLE public.contratos_distratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores gerenciam distratos" ON public.contratos_distratos
  FOR ALL TO authenticated
  USING (public.eh_gestor(auth.uid()))
  WITH CHECK (public.eh_gestor(auth.uid()));

CREATE TRIGGER update_contratos_distratos_updated_at
  BEFORE UPDATE ON public.contratos_distratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();