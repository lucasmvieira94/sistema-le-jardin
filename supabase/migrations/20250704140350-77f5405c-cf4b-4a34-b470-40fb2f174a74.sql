
-- Criar tabela para tipos de afastamento
CREATE TABLE public.tipos_afastamento (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  remunerado BOOLEAN NOT NULL DEFAULT false,
  categoria VARCHAR(50) NOT NULL, -- 'clt', 'abono', 'outros'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir tipos de afastamento previstos pela CLT
INSERT INTO public.tipos_afastamento (codigo, descricao, remunerado, categoria) VALUES
('FALTA', 'Falta não justificada', false, 'clt'),
('ATMED', 'Atestado médico', true, 'clt'),
('LUTO', 'Licença nojo/falecimento', true, 'clt'),
('CASAR', 'Licença casamento', true, 'clt'),
('NASC', 'Licença nascimento filho', true, 'clt'),
('DOACAO', 'Doação de sangue', true, 'clt'),
('ALISTA', 'Alistamento eleitoral', true, 'clt'),
('JURADO', 'Serviço júri', true, 'clt'),
('TESTEM', 'Testemunha judicial', true, 'clt'),
('ACIDENTE', 'Acidente de trabalho', true, 'clt'),
('LICMAT', 'Licença maternidade', true, 'clt'),
('LICPAT', 'Licença paternidade', true, 'clt'),
('ABONO', 'Abono (falta abonada)', true, 'abono'),
('FERIAS', 'Férias', true, 'outros'),
('SUSPEN', 'Suspensão disciplinar', false, 'outros');

-- Criar tabela para registros de afastamentos
CREATE TABLE public.afastamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id),
  tipo_afastamento_id INTEGER NOT NULL REFERENCES public.tipos_afastamento(id),
  tipo_periodo VARCHAR(10) NOT NULL CHECK (tipo_periodo IN ('horas', 'dias')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  hora_inicio TIME,
  hora_fim TIME,
  quantidade_horas INTEGER, -- para afastamentos em horas
  quantidade_dias INTEGER, -- para afastamentos em dias
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tipos_afastamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para tipos_afastamento (leitura para todos autenticados)
CREATE POLICY "Permite select para usuarios autenticados" ON public.tipos_afastamento
FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- Políticas para afastamentos
CREATE POLICY "Permite select para usuarios autenticados" ON public.afastamentos
FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Permite insert para usuarios autenticados" ON public.afastamentos
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permite update para usuarios autenticados" ON public.afastamentos
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permite delete para usuarios autenticados" ON public.afastamentos
FOR DELETE USING (auth.role() = 'authenticated');

-- Função para processar afastamentos e criar registros na folha de ponto
CREATE OR REPLACE FUNCTION public.processar_afastamento()
RETURNS TRIGGER AS $$
DECLARE
  data_atual DATE;
  tipo_registro_valor VARCHAR(50);
BEGIN
  -- Determinar o tipo de registro baseado no tipo de afastamento
  SELECT 
    CASE 
      WHEN ta.remunerado = true THEN 'falta_abonada'
      ELSE 'falta'
    END,
    ta.categoria
  INTO tipo_registro_valor
  FROM tipos_afastamento ta 
  WHERE ta.id = NEW.tipo_afastamento_id;

  -- Se é afastamento por dias, criar um registro para cada dia
  IF NEW.tipo_periodo = 'dias' THEN
    FOR i IN 0..(NEW.quantidade_dias - 1) LOOP
      data_atual := NEW.data_inicio + i;
      
      -- Inserir ou atualizar registro de ponto
      INSERT INTO public.registros_ponto 
        (funcionario_id, data, tipo_registro, observacoes)
      VALUES 
        (NEW.funcionario_id, data_atual, tipo_registro_valor, NEW.observacoes)
      ON CONFLICT (funcionario_id, data) 
      DO UPDATE SET 
        tipo_registro = tipo_registro_valor,
        observacoes = COALESCE(registros_ponto.observacoes, '') || ' | ' || NEW.observacoes,
        updated_at = now();
    END LOOP;
  
  -- Se é afastamento por horas, criar registro para o dia específico
  ELSIF NEW.tipo_periodo = 'horas' THEN
    INSERT INTO public.registros_ponto 
      (funcionario_id, data, tipo_registro, observacoes)
    VALUES 
      (NEW.funcionario_id, NEW.data_inicio, tipo_registro_valor, 
       NEW.observacoes || ' (Afastamento: ' || NEW.quantidade_horas || 'h)')
    ON CONFLICT (funcionario_id, data) 
    DO UPDATE SET 
      tipo_registro = tipo_registro_valor,
      observacoes = COALESCE(registros_ponto.observacoes, '') || ' | ' || NEW.observacoes || ' (' || NEW.quantidade_horas || 'h)',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para processamento automático
CREATE TRIGGER trigger_processar_afastamento
  AFTER INSERT ON public.afastamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.processar_afastamento();

-- Adicionar índices para performance
CREATE INDEX idx_afastamentos_funcionario_id ON public.afastamentos(funcionario_id);
CREATE INDEX idx_afastamentos_data_inicio ON public.afastamentos(data_inicio);
CREATE INDEX idx_afastamentos_tipo ON public.afastamentos(tipo_afastamento_id);
