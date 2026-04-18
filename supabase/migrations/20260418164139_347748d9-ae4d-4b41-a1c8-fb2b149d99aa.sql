-- Catálogo de vacinas recomendadas (PNI - Calendário do Idoso)
CREATE TABLE public.catalogo_vacinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  doses_recomendadas integer NOT NULL DEFAULT 1,
  intervalo_dias integer,
  periodicidade text NOT NULL DEFAULT 'dose_unica',
  obrigatoria_idoso boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_vacinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam catalogo vacinas"
  ON public.catalogo_vacinas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos visualizam catalogo vacinas ativo"
  ON public.catalogo_vacinas FOR SELECT
  USING (ativo = true);

CREATE POLICY "Anon visualiza catalogo vacinas"
  ON public.catalogo_vacinas FOR SELECT TO anon
  USING (ativo = true);

-- Vacinas aplicadas nos residentes
CREATE TABLE public.vacinas_residentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL,
  vacina_id uuid REFERENCES public.catalogo_vacinas(id) ON DELETE SET NULL,
  nome_vacina text NOT NULL,
  data_aplicacao date NOT NULL,
  numero_dose integer NOT NULL DEFAULT 1,
  lote text,
  fabricante text,
  local_aplicacao_corpo text,
  via_administracao text,
  profissional_aplicador text,
  local_aplicacao text,
  reacoes_adversas text,
  observacoes text,
  proxima_dose_prevista date,
  registrado_por_funcionario_id uuid,
  registrado_por_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vacinas_residente ON public.vacinas_residentes(residente_id);
CREATE INDEX idx_vacinas_proxima ON public.vacinas_residentes(proxima_dose_prevista) WHERE proxima_dose_prevista IS NOT NULL;

ALTER TABLE public.vacinas_residentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vacinas residentes"
  ON public.vacinas_residentes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionarios autenticados visualizam vacinas"
  ON public.vacinas_residentes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Funcionarios autenticados registram vacinas"
  ON public.vacinas_residentes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon visualiza vacinas residentes"
  ON public.vacinas_residentes FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon registra vacinas residentes"
  ON public.vacinas_residentes FOR INSERT TO anon
  WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_catalogo_vacinas_updated
  BEFORE UPDATE ON public.catalogo_vacinas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_vacinas_residentes_updated
  BEFORE UPDATE ON public.vacinas_residentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed do catálogo (PNI - Calendário do Idoso)
INSERT INTO public.catalogo_vacinas (nome, descricao, doses_recomendadas, intervalo_dias, periodicidade, obrigatoria_idoso, ordem) VALUES
  ('Influenza (Gripe)', 'Vacina anual contra os principais subtipos do vírus Influenza', 1, 365, 'anual', true, 1),
  ('Pneumocócica 23 (VPP23)', 'Previne pneumonia, meningite e otite causadas pelo pneumococo', 2, 1825, 'reforco_5_anos', true, 2),
  ('Pneumocócica 13 (VPC13)', 'Vacina conjugada contra 13 sorotipos do pneumococo', 1, NULL, 'dose_unica', true, 3),
  ('COVID-19 (Reforço)', 'Reforço anual ou semestral conforme orientação do Ministério da Saúde', 1, 180, 'semestral', true, 4),
  ('Hepatite B', 'Esquema de 3 doses (0, 1 e 6 meses)', 3, 30, 'esquema_completo', false, 5),
  ('dT (Dupla Adulto - Difteria/Tétano)', 'Reforço a cada 10 anos', 1, 3650, 'reforco_10_anos', true, 6),
  ('Herpes Zoster', 'Recomendada para idosos a partir de 50 anos', 2, 60, 'esquema_completo', true, 7),
  ('Febre Amarela', 'Dose única para áreas de risco', 1, NULL, 'dose_unica', false, 8),
  ('Tríplice Viral (SCR)', 'Sarampo, Caxumba e Rubéola', 1, NULL, 'dose_unica', false, 9);