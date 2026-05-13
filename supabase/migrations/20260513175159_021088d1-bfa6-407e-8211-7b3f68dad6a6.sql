ALTER TABLE public.mensalidades_residentes
  DROP CONSTRAINT IF EXISTS mensalidades_residentes_residente_id_competencia_key;
CREATE UNIQUE INDEX IF NOT EXISTS mensalidades_res_comp_ativa_uniq
  ON public.mensalidades_residentes (residente_id, competencia)
  WHERE status <> 'cancelado';