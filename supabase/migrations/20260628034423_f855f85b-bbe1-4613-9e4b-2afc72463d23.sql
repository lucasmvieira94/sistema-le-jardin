CREATE UNIQUE INDEX IF NOT EXISTS idx_prontuario_registros_ciclo_completo_unico
ON public.prontuario_registros (ciclo_id)
WHERE tipo_registro = 'prontuario_completo' AND ciclo_id IS NOT NULL;