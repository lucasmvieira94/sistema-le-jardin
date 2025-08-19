-- Tabela de medicamentos (cadastro dos medicamentos disponíveis)
CREATE TABLE public.medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  principio_ativo text,
  dosagem text, -- Ex: "500mg", "10ml/dose"
  forma_farmaceutica text, -- Ex: "comprimido", "xarope", "injetável"
  fabricante text,
  codigo_barras text,
  concentracao text, -- Ex: "500mg/ml"
  unidade_medida text NOT NULL DEFAULT 'unidade', -- "unidade", "ml", "mg", etc
  prescricao_obrigatoria boolean DEFAULT false,
  controlado boolean DEFAULT false, -- Se é medicamento controlado
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de controle de estoque
CREATE TABLE public.estoque_medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  lote text,
  data_validade date,
  quantidade_atual numeric(10,2) NOT NULL DEFAULT 0,
  quantidade_minima numeric(10,2) DEFAULT 10, -- Alerta quando ficar abaixo deste valor
  quantidade_maxima numeric(10,2) DEFAULT 1000,
  preco_unitario numeric(10,2),
  fornecedor text,
  data_entrada date DEFAULT CURRENT_DATE,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de prescrições/mapeamento de medicamentos por residente
CREATE TABLE public.residentes_medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  dosagem_prescrita text NOT NULL, -- Ex: "1 comprimido", "5ml"
  frequencia text NOT NULL, -- Ex: "8/8h", "12/12h", "1x ao dia"
  horarios jsonb, -- Array de horários: ["08:00", "16:00", "00:00"]
  via_administracao text, -- "oral", "intramuscular", "tópica", etc.
  observacoes text,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date, -- Se for tratamento com prazo definido
  ativo boolean DEFAULT true,
  prescrito_por text, -- Nome do médico responsável
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de registro de administração de medicamentos
CREATE TABLE public.administracao_medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  estoque_medicamento_id uuid REFERENCES public.estoque_medicamentos(id),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id),
  data_administracao date NOT NULL DEFAULT CURRENT_DATE,
  horario_administracao time NOT NULL DEFAULT CURRENT_TIME,
  dosagem_administrada text NOT NULL,
  quantidade_utilizada numeric(10,2) NOT NULL,
  via_administracao text,
  observacoes text,
  status text DEFAULT 'administrado', -- "administrado", "recusado", "não_disponivel"
  created_at timestamp with time zone DEFAULT now()
);

-- Tabela para controle de entradas no estoque
CREATE TABLE public.entrada_medicamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  estoque_medicamento_id uuid NOT NULL REFERENCES public.estoque_medicamentos(id) ON DELETE CASCADE,
  quantidade numeric(10,2) NOT NULL,
  preco_unitario numeric(10,2),
  preco_total numeric(10,2),
  fornecedor text,
  numero_nota_fiscal text,
  data_compra date DEFAULT CURRENT_DATE,
  funcionario_responsavel uuid REFERENCES public.funcionarios(id),
  observacoes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_estoque_medicamentos_medicamento_id ON public.estoque_medicamentos(medicamento_id);
CREATE INDEX idx_estoque_medicamentos_quantidade ON public.estoque_medicamentos(quantidade_atual);
CREATE INDEX idx_residentes_medicamentos_residente_id ON public.residentes_medicamentos(residente_id);
CREATE INDEX idx_residentes_medicamentos_medicamento_id ON public.residentes_medicamentos(medicamento_id);
CREATE INDEX idx_administracao_medicamentos_residente_id ON public.administracao_medicamentos(residente_id);
CREATE INDEX idx_administracao_medicamentos_data ON public.administracao_medicamentos(data_administracao);

-- RLS Policies

-- Medicamentos
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar medicamentos" ON public.medicamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar medicamentos ativos" ON public.medicamentos
  FOR SELECT USING (ativo = true);

-- Estoque de medicamentos
ALTER TABLE public.estoque_medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar estoque de medicamentos" ON public.estoque_medicamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar estoque ativo" ON public.estoque_medicamentos
  FOR SELECT USING (ativo = true);

-- Prescrições de residentes
ALTER TABLE public.residentes_medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar prescrições" ON public.residentes_medicamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar prescrições ativas" ON public.residentes_medicamentos
  FOR SELECT USING (ativo = true);

-- Administração de medicamentos
ALTER TABLE public.administracao_medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar administrações" ON public.administracao_medicamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem inserir administrações" ON public.administracao_medicamentos
  FOR INSERT WITH CHECK (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  ));

CREATE POLICY "Funcionários podem visualizar administrações" ON public.administracao_medicamentos
  FOR SELECT USING (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  ));

-- Entrada de medicamentos
ALTER TABLE public.entrada_medicamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar entradas" ON public.entrada_medicamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar entradas" ON public.entrada_medicamentos
  FOR SELECT USING (funcionario_responsavel IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  ));

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_medicamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_medicamentos_updated_at
  BEFORE UPDATE ON public.medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medicamentos_updated_at();

CREATE TRIGGER update_estoque_medicamentos_updated_at
  BEFORE UPDATE ON public.estoque_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medicamentos_updated_at();

CREATE TRIGGER update_residentes_medicamentos_updated_at
  BEFORE UPDATE ON public.residentes_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medicamentos_updated_at();

-- Trigger para atualizar estoque quando medicamento é administrado
CREATE OR REPLACE FUNCTION public.atualizar_estoque_medicamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualizar se foi realmente administrado e tem referência ao estoque
  IF NEW.status = 'administrado' AND NEW.estoque_medicamento_id IS NOT NULL THEN
    UPDATE public.estoque_medicamentos
    SET quantidade_atual = quantidade_atual - NEW.quantidade_utilizada,
        updated_at = now()
    WHERE id = NEW.estoque_medicamento_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_estoque_medicamento
  AFTER INSERT ON public.administracao_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_estoque_medicamento();

-- Trigger para atualizar estoque quando há entrada de medicamentos
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.estoque_medicamentos
  SET quantidade_atual = quantidade_atual + NEW.quantidade,
      updated_at = now()
  WHERE id = NEW.estoque_medicamento_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_estoque_entrada
  AFTER INSERT ON public.entrada_medicamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_estoque_entrada();

-- Função para obter medicamentos com estoque baixo
CREATE OR REPLACE FUNCTION public.obter_medicamentos_estoque_baixo()
RETURNS TABLE(
  medicamento_nome text,
  quantidade_atual numeric,
  quantidade_minima numeric,
  dias_restantes integer,
  lote text,
  data_validade date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.nome,
    e.quantidade_atual,
    e.quantidade_minima,
    CASE 
      WHEN e.data_validade IS NOT NULL THEN 
        (e.data_validade - CURRENT_DATE)::integer
      ELSE NULL
    END as dias_restantes,
    e.lote,
    e.data_validade
  FROM public.estoque_medicamentos e
  JOIN public.medicamentos m ON e.medicamento_id = m.id
  WHERE e.ativo = true 
    AND m.ativo = true
    AND (e.quantidade_atual <= e.quantidade_minima 
         OR (e.data_validade IS NOT NULL AND e.data_validade <= CURRENT_DATE + INTERVAL '30 days'))
  ORDER BY e.quantidade_atual ASC, e.data_validade ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter horários de medicamentos de um residente
CREATE OR REPLACE FUNCTION public.obter_horarios_medicamentos_residente(p_residente_id uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  medicamento_nome text,
  dosagem_prescrita text,
  horarios jsonb,
  via_administracao text,
  observacoes text,
  quantidade_estoque numeric,
  prescricao_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.nome,
    rm.dosagem_prescrita,
    rm.horarios,
    rm.via_administracao,
    rm.observacoes,
    COALESCE(SUM(e.quantidade_atual), 0) as quantidade_estoque,
    rm.id as prescricao_id
  FROM public.residentes_medicamentos rm
  JOIN public.medicamentos m ON rm.medicamento_id = m.id
  LEFT JOIN public.estoque_medicamentos e ON m.id = e.medicamento_id AND e.ativo = true
  WHERE rm.residente_id = p_residente_id
    AND rm.ativo = true
    AND m.ativo = true
    AND (rm.data_inicio <= p_data)
    AND (rm.data_fim IS NULL OR rm.data_fim >= p_data)
  GROUP BY m.nome, rm.dosagem_prescrita, rm.horarios, rm.via_administracao, rm.observacoes, rm.id
  ORDER BY m.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;