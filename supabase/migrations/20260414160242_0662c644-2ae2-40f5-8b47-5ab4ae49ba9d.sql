
-- Adicionar campos ao estoque_medicamentos
ALTER TABLE public.estoque_medicamentos 
ADD COLUMN IF NOT EXISTS residente_id uuid REFERENCES public.residentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo_estoque text NOT NULL DEFAULT 'residente';

-- Index para busca por residente
CREATE INDEX IF NOT EXISTS idx_estoque_medicamentos_residente ON public.estoque_medicamentos(residente_id);
CREATE INDEX IF NOT EXISTS idx_estoque_medicamentos_tipo ON public.estoque_medicamentos(tipo_estoque);

-- Atualizar registros existentes sem residente como urgência
UPDATE public.estoque_medicamentos SET tipo_estoque = 'urgencia' WHERE residente_id IS NULL;

-- Criar tabela de prescrições
CREATE TABLE public.prescricoes_medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  dosagem text NOT NULL,
  frequencia_tipo text NOT NULL DEFAULT 'hora_fixa_diaria',
  frequencia_valor integer,
  horarios text[] DEFAULT '{}',
  dia_semana integer,
  intervalo_dias integer,
  via_administracao text,
  prescrito_por text,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prescricoes_residente ON public.prescricoes_medicamentos(residente_id);
CREATE INDEX idx_prescricoes_medicamento ON public.prescricoes_medicamentos(medicamento_id);
CREATE INDEX idx_prescricoes_ativo ON public.prescricoes_medicamentos(ativo);

-- RLS
ALTER TABLE public.prescricoes_medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar prescrições"
ON public.prescricoes_medicamentos
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar prescrições"
ON public.prescricoes_medicamentos
FOR SELECT
TO public
USING (EXISTS (
  SELECT 1 FROM funcionarios WHERE funcionarios.ativo = true
));

CREATE POLICY "Funcionários podem inserir prescrições"
ON public.prescricoes_medicamentos
FOR INSERT
TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM funcionarios WHERE funcionarios.ativo = true
));

-- Trigger para updated_at
CREATE TRIGGER update_prescricoes_medicamentos_updated_at
BEFORE UPDATE ON public.prescricoes_medicamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo residente_id à entrada_medicamentos também
ALTER TABLE public.entrada_medicamentos
ADD COLUMN IF NOT EXISTS residente_id uuid REFERENCES public.residentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo_estoque text NOT NULL DEFAULT 'residente';

-- Função para dar baixa automática no estoque ao administrar medicamento
CREATE OR REPLACE FUNCTION public.baixar_estoque_medicamento()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.estoque_medicamentos
  SET quantidade_atual = quantidade_atual - NEW.quantidade_utilizada,
      updated_at = now()
  WHERE id = NEW.estoque_medicamento_id
    AND quantidade_atual >= NEW.quantidade_utilizada;
  
  IF NOT FOUND AND NEW.estoque_medicamento_id IS NOT NULL THEN
    RAISE EXCEPTION 'Estoque insuficiente para este medicamento';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para baixa automática
DROP TRIGGER IF EXISTS trigger_baixar_estoque_medicamento ON public.administracao_medicamentos;
CREATE TRIGGER trigger_baixar_estoque_medicamento
AFTER INSERT ON public.administracao_medicamentos
FOR EACH ROW
EXECUTE FUNCTION public.baixar_estoque_medicamento();
