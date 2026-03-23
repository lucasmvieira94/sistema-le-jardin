-- Enum para prioridade
CREATE TYPE public.intercorrencia_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');

-- Enum para status
CREATE TYPE public.intercorrencia_status AS ENUM ('aberta', 'em_analise', 'em_andamento', 'resolvida', 'encerrada');

-- Enum para categoria
CREATE TYPE public.intercorrencia_categoria AS ENUM ('saude_residente', 'infraestrutura', 'comportamental', 'medicacao');

-- Tabela principal de intercorrências
CREATE TABLE public.intercorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  categoria intercorrencia_categoria NOT NULL,
  prioridade intercorrencia_prioridade NOT NULL DEFAULT 'media',
  status intercorrencia_status NOT NULL DEFAULT 'aberta',
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  residente_id uuid REFERENCES public.residentes(id) ON DELETE SET NULL,
  prazo_resolucao timestamp with time zone,
  data_resolucao timestamp with time zone,
  feedback_gestor text,
  feedback_data timestamp with time zone,
  feedback_por uuid REFERENCES public.funcionarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de logs/histórico de alterações
CREATE TABLE public.intercorrencias_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intercorrencia_id uuid NOT NULL REFERENCES public.intercorrencias(id) ON DELETE CASCADE,
  acao text NOT NULL,
  descricao text,
  usuario_nome text NOT NULL,
  usuario_tipo text NOT NULL DEFAULT 'funcionario',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.intercorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercorrencias_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para intercorrencias
CREATE POLICY "Admins podem gerenciar intercorrencias" ON public.intercorrencias
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon pode inserir intercorrencias" ON public.intercorrencias
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon pode visualizar intercorrencias" ON public.intercorrencias
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon pode atualizar intercorrencias" ON public.intercorrencias
  FOR UPDATE TO anon
  USING (true);

-- Políticas para intercorrencias_logs
CREATE POLICY "Admins podem gerenciar logs" ON public.intercorrencias_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon pode inserir logs" ON public.intercorrencias_logs
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon pode visualizar logs" ON public.intercorrencias_logs
  FOR SELECT TO anon
  USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_intercorrencia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_intercorrencia_updated_at
  BEFORE UPDATE ON public.intercorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_intercorrencia_updated_at();