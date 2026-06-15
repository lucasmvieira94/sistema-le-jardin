-- Adiciona campos de biometria facial em funcionários
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS biometria_facial jsonb,
  ADD COLUMN IF NOT EXISTS biometria_cadastrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS biometria_obrigatoria boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.funcionarios.biometria_facial IS 'Array de 128 floats (descriptor facial gerado pelo face-api.js). Não é uma foto, apenas vetor matemático.';
COMMENT ON COLUMN public.funcionarios.biometria_cadastrada_em IS 'Timestamp do último cadastro/atualização da biometria';
COMMENT ON COLUMN public.funcionarios.biometria_obrigatoria IS 'Se true, exige validação biométrica nos fluxos sensíveis';

-- Log de tentativas de validação biométrica (auditoria LGPD)
CREATE TABLE IF NOT EXISTS public.biometria_validacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tenant_id uuid,
  contexto text NOT NULL,
  sucesso boolean NOT NULL,
  distancia numeric,
  threshold numeric,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.biometria_validacoes_log TO authenticated;
GRANT SELECT, INSERT ON public.biometria_validacoes_log TO anon;
GRANT ALL ON public.biometria_validacoes_log TO service_role;

ALTER TABLE public.biometria_validacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção pública de logs de biometria"
  ON public.biometria_validacoes_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Leitura de logs por autenticados"
  ON public.biometria_validacoes_log FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_biometria_log_funcionario ON public.biometria_validacoes_log(funcionario_id, created_at DESC);