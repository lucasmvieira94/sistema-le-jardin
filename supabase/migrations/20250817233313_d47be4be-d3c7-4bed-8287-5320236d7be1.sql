-- Criar tabela para configuração de campos do formulário de prontuário
CREATE TABLE public.formulario_campos_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secao character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo IN ('text', 'textarea', 'select', 'checkbox', 'radio', 'number', 'slider')),
  label text NOT NULL,
  placeholder text,
  opcoes text[], -- Array de opções para campos select, radio, checkbox
  obrigatorio boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  configuracoes jsonb, -- Para configurações específicas como min, max, step, rows
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.formulario_campos_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar campos do formulário" 
ON public.formulario_campos_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar campos ativos do formulário" 
ON public.formulario_campos_config 
FOR SELECT 
USING (ativo = true);

-- Inserir alguns campos padrão
INSERT INTO public.formulario_campos_config (secao, tipo, label, opcoes, obrigatorio, ativo, ordem) VALUES
('rotina_diaria', 'radio', 'Qualidade do sono', ARRAY['Boa', 'Regular', 'Ruim'], true, true, 1),
('rotina_diaria', 'radio', 'Alimentação', ARRAY['Se alimenta sozinho', 'Precisa de ajuda', 'Dieta especial'], true, true, 2),
('rotina_diaria', 'radio', 'Mobilidade', ARRAY['Independente', 'Usa bengala/andador', 'Cadeira de rodas', 'Acamado'], true, true, 3),
('aspectos_clinicos', 'text', 'Pressão arterial', null, false, true, 1),
('aspectos_clinicos', 'text', 'Temperatura corporal', null, false, true, 2),
('aspectos_clinicos', 'textarea', 'Medicamentos administrados', null, false, true, 3),
('bem_estar', 'slider', 'Nível de dor (0-10)', null, false, true, 1),
('bem_estar', 'radio', 'Estado emocional', ARRAY['Alegre', 'Calmo', 'Ansioso', 'Triste', 'Irritado'], false, true, 2),
('bem_estar', 'radio', 'Participação em atividades', ARRAY['Ativa', 'Moderada', 'Pouca', 'Nenhuma'], false, true, 3),
('ocorrencias', 'checkbox', 'Intercorrências', ARRAY['Queda', 'Confusão mental', 'Agitação', 'Recusa medicação', 'Outros'], false, true, 1),
('ocorrencias', 'textarea', 'Descrição detalhada', null, false, true, 2),
('observacoes', 'textarea', 'Observações gerais', null, false, true, 1);

-- Atualizar configurações para o campo slider
UPDATE public.formulario_campos_config 
SET configuracoes = '{"min": 0, "max": 10, "step": 1}'::jsonb 
WHERE tipo = 'slider' AND label = 'Nível de dor (0-10)';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_formulario_campos_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_formulario_campos_config_updated_at
BEFORE UPDATE ON public.formulario_campos_config
FOR EACH ROW
EXECUTE FUNCTION public.update_formulario_campos_config_updated_at();