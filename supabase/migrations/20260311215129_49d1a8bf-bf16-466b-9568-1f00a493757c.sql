
CREATE TABLE public.feedback_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  funcionario_nome text NOT NULL,
  facilidade_uso text NOT NULL,
  processos_manuais text,
  funcionalidades_desejadas text,
  dificuldade_ferramentas_digitais text NOT NULL,
  melhorias_sugeridas text,
  satisfacao_registro_ponto text,
  satisfacao_prontuario text,
  satisfacao_controle_temperatura text,
  satisfacao_controle_fraldas text,
  satisfacao_escala text,
  sugestoes text,
  criticas text,
  elogios text,
  observacoes_gerais text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_sistema ENABLE ROW LEVEL SECURITY;

-- Anon can insert feedback (employee code access)
CREATE POLICY "Anon can insert feedback" ON public.feedback_sistema
  FOR INSERT TO anon WITH CHECK (true);

-- Anon can view own feedback
CREATE POLICY "Anon can view feedback" ON public.feedback_sistema
  FOR SELECT TO anon USING (true);

-- Authenticated full access
CREATE POLICY "Authenticated full access feedback" ON public.feedback_sistema
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
