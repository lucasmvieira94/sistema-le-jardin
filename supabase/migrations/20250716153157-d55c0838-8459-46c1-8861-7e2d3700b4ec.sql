-- Fix database performance issues identified by linter

-- 1. Add missing index for foreign key on funcionarios.escala_id
CREATE INDEX IF NOT EXISTS idx_funcionarios_escala_id ON public.funcionarios(escala_id);

-- 2. Remove unused indexes to reduce storage overhead
DROP INDEX IF EXISTS public.idx_registros_ponto_data;
DROP INDEX IF EXISTS public.idx_registros_ponto_funcionario_data;
DROP INDEX IF EXISTS public.idx_afastamentos_data_inicio;
DROP INDEX IF EXISTS public.idx_afastamentos_funcionario_id;
DROP INDEX IF EXISTS public.idx_afastamentos_tipo;