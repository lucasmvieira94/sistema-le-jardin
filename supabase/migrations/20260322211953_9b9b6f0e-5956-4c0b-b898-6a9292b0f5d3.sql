
-- Tabela de advertências e suspensões conforme CLT
CREATE TABLE public.advertencias_suspensoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo VARCHAR NOT NULL CHECK (tipo IN ('advertencia_verbal', 'advertencia_escrita', 'suspensao', 'justa_causa')),
  motivo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_ocorrencia DATE NOT NULL,
  data_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dias_suspensao INTEGER, -- para suspensões (máx 30 dias CLT art. 474)
  data_inicio_suspensao DATE,
  data_fim_suspensao DATE,
  testemunha_1 TEXT,
  testemunha_2 TEXT,
  funcionario_recusou_assinar BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.advertencias_suspensoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar advertências"
  ON public.advertencias_suspensoes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem ver suas próprias advertências"
  ON public.advertencias_suspensoes
  FOR SELECT
  TO authenticated
  USING (funcionario_id IN (
    SELECT id FROM funcionarios WHERE user_id = auth.uid()
  ));
