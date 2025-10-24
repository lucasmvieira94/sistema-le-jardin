-- Criar tabela de estoque de fraldas
CREATE TABLE IF NOT EXISTS public.estoque_fraldas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tipo_fralda VARCHAR(100) NOT NULL,
  tamanho VARCHAR(50) NOT NULL,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER NOT NULL DEFAULT 100,
  unidade_medida VARCHAR(20) NOT NULL DEFAULT 'unidades',
  localizacao VARCHAR(100),
  fornecedor TEXT,
  preco_unitario NUMERIC(10,2),
  data_ultima_compra DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  consumo_medio_diario NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de uso de fraldas
CREATE TABLE IF NOT EXISTS public.uso_fraldas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  estoque_fralda_id UUID NOT NULL REFERENCES public.estoque_fraldas(id) ON DELETE CASCADE,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id),
  data_uso DATE NOT NULL DEFAULT CURRENT_DATE,
  horario_uso TIME NOT NULL DEFAULT CURRENT_TIME,
  quantidade_usada INTEGER NOT NULL DEFAULT 1,
  tipo_troca VARCHAR(50),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de configurações de alertas
CREATE TABLE IF NOT EXISTS public.configuracoes_alertas_fraldas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  dias_alerta_critico INTEGER NOT NULL DEFAULT 3,
  dias_alerta_aviso INTEGER NOT NULL DEFAULT 7,
  dias_alerta_atencao INTEGER NOT NULL DEFAULT 15,
  notificar_email BOOLEAN NOT NULL DEFAULT true,
  notificar_dashboard BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at em estoque_fraldas
CREATE TRIGGER update_estoque_fraldas_updated_at
  BEFORE UPDATE ON public.estoque_fraldas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em configuracoes_alertas_fraldas
CREATE TRIGGER update_configuracoes_alertas_fraldas_updated_at
  BEFORE UPDATE ON public.configuracoes_alertas_fraldas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar estoque após uso
CREATE OR REPLACE FUNCTION public.atualizar_estoque_fralda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.estoque_fraldas
  SET quantidade_atual = quantidade_atual - NEW.quantidade_usada,
      updated_at = now()
  WHERE id = NEW.estoque_fralda_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER atualizar_estoque_apos_uso
  AFTER INSERT ON public.uso_fraldas
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_estoque_fralda();

-- Função para calcular consumo médio diário
CREATE OR REPLACE FUNCTION public.calcular_consumo_medio_fraldas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_usado NUMERIC;
  dias_periodo INTEGER := 30;
BEGIN
  SELECT COALESCE(SUM(quantidade_usada), 0)
  INTO total_usado
  FROM public.uso_fraldas
  WHERE estoque_fralda_id = NEW.estoque_fralda_id
    AND data_uso >= CURRENT_DATE - dias_periodo;
  
  UPDATE public.estoque_fraldas
  SET consumo_medio_diario = total_usado / NULLIF(dias_periodo, 0),
      updated_at = now()
  WHERE id = NEW.estoque_fralda_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calcular_consumo_medio_apos_uso
  AFTER INSERT ON public.uso_fraldas
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_consumo_medio_fraldas();

-- Função para obter alertas de estoque
CREATE OR REPLACE FUNCTION public.obter_alertas_estoque_fraldas()
RETURNS TABLE(
  estoque_id UUID,
  tipo_fralda TEXT,
  tamanho TEXT,
  quantidade_atual INTEGER,
  consumo_medio_diario NUMERIC,
  dias_restantes INTEGER,
  nivel_alerta VARCHAR(20),
  localizacao TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  config RECORD;
BEGIN
  -- Buscar configurações de alerta
  SELECT * INTO config
  FROM public.configuracoes_alertas_fraldas
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não houver configuração, usar valores padrão
  IF NOT FOUND THEN
    config.dias_alerta_critico := 3;
    config.dias_alerta_aviso := 7;
    config.dias_alerta_atencao := 15;
  END IF;
  
  RETURN QUERY
  SELECT 
    e.id as estoque_id,
    e.tipo_fralda,
    e.tamanho,
    e.quantidade_atual,
    e.consumo_medio_diario,
    CASE 
      WHEN e.consumo_medio_diario > 0 THEN 
        FLOOR(e.quantidade_atual / e.consumo_medio_diario)::INTEGER
      ELSE 999
    END as dias_restantes,
    CASE
      WHEN e.consumo_medio_diario > 0 AND 
           FLOOR(e.quantidade_atual / e.consumo_medio_diario) <= config.dias_alerta_critico 
      THEN 'critico'
      WHEN e.consumo_medio_diario > 0 AND 
           FLOOR(e.quantidade_atual / e.consumo_medio_diario) <= config.dias_alerta_aviso 
      THEN 'aviso'
      WHEN e.consumo_medio_diario > 0 AND 
           FLOOR(e.quantidade_atual / e.consumo_medio_diario) <= config.dias_alerta_atencao 
      THEN 'atencao'
      ELSE 'normal'
    END::VARCHAR(20) as nivel_alerta,
    e.localizacao
  FROM public.estoque_fraldas e
  WHERE e.ativo = true
    AND e.consumo_medio_diario > 0
    AND FLOOR(e.quantidade_atual / e.consumo_medio_diario) <= config.dias_alerta_atencao
  ORDER BY dias_restantes ASC;
END;
$$;

-- RLS Policies para estoque_fraldas
ALTER TABLE public.estoque_fraldas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar estoque de fraldas"
  ON public.estoque_fraldas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar estoque ativo"
  ON public.estoque_fraldas
  FOR SELECT
  USING (ativo = true);

-- RLS Policies para uso_fraldas
ALTER TABLE public.uso_fraldas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar uso de fraldas"
  ON public.uso_fraldas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem registrar uso"
  ON public.uso_fraldas
  FOR INSERT
  WITH CHECK (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  ));

CREATE POLICY "Funcionários podem visualizar uso"
  ON public.uso_fraldas
  FOR SELECT
  USING (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true
  ));

-- RLS Policies para configuracoes_alertas_fraldas
ALTER TABLE public.configuracoes_alertas_fraldas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar configurações de alertas"
  ON public.configuracoes_alertas_fraldas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Funcionários podem visualizar configurações"
  ON public.configuracoes_alertas_fraldas
  FOR SELECT
  USING (true);