-- Criar tabela para controle de ciclos de prontuário
CREATE TABLE public.prontuario_ciclos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_ciclo DATE NOT NULL,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'completo', 'encerrado')),
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_encerramento TIMESTAMP WITH TIME ZONE,
  funcionario_encerrou UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(data_ciclo, residente_id)
);

-- Modificar tabela de registros para incluir referência ao ciclo
ALTER TABLE public.prontuario_registros 
ADD COLUMN ciclo_id UUID REFERENCES public.prontuario_ciclos(id) ON DELETE CASCADE;

-- Criar tabela para templates de registros obrigatórios
CREATE TABLE public.prontuario_templates_obrigatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_registro VARCHAR(50) NOT NULL,
  titulo TEXT NOT NULL,
  descricao_padrao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir templates obrigatórios
INSERT INTO public.prontuario_templates_obrigatorios (tipo_registro, titulo, descricao_padrao, ordem) VALUES
('medicacao', 'Administração de Medicamentos Matutinos', 'Verificar e administrar medicamentos prescritos para o período matutino', 1),
('medicacao', 'Administração de Medicamentos Vespertinos', 'Verificar e administrar medicamentos prescritos para o período vespertino', 2),
('medicacao', 'Administração de Medicamentos Noturnos', 'Verificar e administrar medicamentos prescritos para o período noturno', 3),
('alimentacao', 'Café da Manhã', 'Registrar aceitação e observações sobre o café da manhã', 4),
('alimentacao', 'Almoço', 'Registrar aceitação e observações sobre o almoço', 5),
('alimentacao', 'Jantar', 'Registrar aceitação e observações sobre o jantar', 6),
('cuidados_pessoais', 'Higiene Matinal', 'Banho, escovação de dentes e cuidados gerais', 7),
('cuidados_pessoais', 'Troca de Fraldas/Vestuário', 'Registrar trocas e condições da pele', 8),
('cuidados_medicos', 'Sinais Vitais', 'Aferição de pressão arterial, temperatura, saturação', 9),
('cuidados_medicos', 'Controle Glicêmico', 'Verificação de glicemia (se aplicável)', 10),
('observacao', 'Estado Geral do Residente', 'Observações sobre comportamento, humor e condições gerais', 11),
('recreacao', 'Atividades do Dia', 'Participação em atividades recreativas ou terapêuticas', 12);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.prontuario_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuario_templates_obrigatorios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para prontuario_ciclos
CREATE POLICY "Admins podem gerenciar ciclos" ON public.prontuario_ciclos
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar ciclos" ON public.prontuario_ciclos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios 
    WHERE funcionarios.ativo = true
  )
);

CREATE POLICY "Funcionários podem atualizar ciclos em andamento" ON public.prontuario_ciclos
FOR UPDATE USING (
  status = 'em_andamento' AND
  EXISTS (
    SELECT 1 FROM public.funcionarios 
    WHERE funcionarios.ativo = true
  )
);

-- Políticas RLS para templates obrigatórios
CREATE POLICY "Todos podem visualizar templates ativos" ON public.prontuario_templates_obrigatorios
FOR SELECT USING (ativo = true);

CREATE POLICY "Admins podem gerenciar templates" ON public.prontuario_templates_obrigatorios
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para criar ciclo diário automático
CREATE OR REPLACE FUNCTION public.criar_ciclo_prontuario_diario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  residente_record RECORD;
  ciclo_id UUID;
  template_record RECORD;
BEGIN
  -- Para cada residente ativo
  FOR residente_record IN 
    SELECT id FROM public.residentes WHERE ativo = true
  LOOP
    -- Verificar se já existe ciclo para hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.prontuario_ciclos 
      WHERE data_ciclo = CURRENT_DATE 
      AND residente_id = residente_record.id
    ) THEN
      -- Criar novo ciclo
      INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status)
      VALUES (CURRENT_DATE, residente_record.id, 'em_andamento')
      RETURNING id INTO ciclo_id;
      
      -- Criar registros obrigatórios baseados nos templates
      FOR template_record IN 
        SELECT * FROM public.prontuario_templates_obrigatorios 
        WHERE ativo = true 
        ORDER BY ordem
      LOOP
        INSERT INTO public.prontuario_registros (
          ciclo_id,
          residente_id,
          funcionario_id,
          data_registro,
          horario_registro,
          tipo_registro,
          titulo,
          descricao
        ) VALUES (
          ciclo_id,
          residente_record.id,
          NULL, -- Será preenchido quando o funcionário registrar
          CURRENT_DATE,
          CURRENT_TIME,
          template_record.tipo_registro,
          template_record.titulo,
          COALESCE(template_record.descricao_padrao, '')
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Função para verificar se ciclo está completo
CREATE OR REPLACE FUNCTION public.verificar_ciclo_completo(p_ciclo_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_registros INTEGER;
  registros_preenchidos INTEGER;
BEGIN
  -- Contar total de registros do ciclo
  SELECT COUNT(*) INTO total_registros
  FROM public.prontuario_registros
  WHERE ciclo_id = p_ciclo_id;
  
  -- Contar registros preenchidos (com funcionário e descrição não vazia)
  SELECT COUNT(*) INTO registros_preenchidos
  FROM public.prontuario_registros
  WHERE ciclo_id = p_ciclo_id
  AND funcionario_id IS NOT NULL
  AND descricao IS NOT NULL
  AND TRIM(descricao) != '';
  
  RETURN total_registros > 0 AND total_registros = registros_preenchidos;
END;
$$;

-- Função para atualizar status do ciclo
CREATE OR REPLACE FUNCTION public.atualizar_status_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ciclo_completo BOOLEAN;
BEGIN
  -- Verificar se o ciclo está completo
  IF NEW.ciclo_id IS NOT NULL THEN
    SELECT public.verificar_ciclo_completo(NEW.ciclo_id) INTO ciclo_completo;
    
    -- Atualizar status do ciclo se estiver completo
    IF ciclo_completo THEN
      UPDATE public.prontuario_ciclos
      SET status = 'completo', updated_at = now()
      WHERE id = NEW.ciclo_id AND status = 'em_andamento';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar status do ciclo quando registro for alterado
CREATE TRIGGER atualizar_status_ciclo_trigger
AFTER INSERT OR UPDATE ON public.prontuario_registros
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_status_ciclo();

-- Função para encerrar ciclo
CREATE OR REPLACE FUNCTION public.encerrar_ciclo_prontuario(p_ciclo_id UUID, p_funcionario_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.prontuario_ciclos
  SET 
    status = 'encerrado',
    data_encerramento = now(),
    funcionario_encerrou = p_funcionario_id,
    updated_at = now()
  WHERE id = p_ciclo_id
  AND status IN ('em_andamento', 'completo');
  
  RETURN FOUND;
END;
$$;