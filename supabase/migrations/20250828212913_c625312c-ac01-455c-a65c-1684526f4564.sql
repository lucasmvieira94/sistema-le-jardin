-- Criar tabela para configurações de prontuário
CREATE TABLE public.configuracoes_prontuario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  horario_inicio_ciclo TIME NOT NULL DEFAULT '08:00:00',
  tempo_limite_horas INTEGER NOT NULL DEFAULT 24,
  notificar_atraso BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.configuracoes_prontuario (horario_inicio_ciclo, tempo_limite_horas, notificar_atraso)
VALUES ('08:00:00', 24, true);

-- Habilitar RLS
ALTER TABLE public.configuracoes_prontuario ENABLE ROW LEVEL SECURITY;

-- Política para admins gerenciarem configurações
CREATE POLICY "Admins podem gerenciar configurações de prontuário"
ON public.configuracoes_prontuario 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Política para funcionários visualizarem configurações
CREATE POLICY "Funcionários podem visualizar configurações de prontuário"
ON public.configuracoes_prontuario 
FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_configuracoes_prontuario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuracoes_prontuario_updated_at
  BEFORE UPDATE ON public.configuracoes_prontuario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_configuracoes_prontuario_updated_at();

-- Adicionar coluna para marcar quando o ciclo realmente começou
ALTER TABLE public.prontuario_ciclos 
ADD COLUMN data_inicio_efetivo TIMESTAMPTZ;

-- Função para verificar se prontuário está em atraso
CREATE OR REPLACE FUNCTION public.verificar_prontuario_em_atraso(p_ciclo_id uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ciclo_record RECORD;
  config_record RECORD;
  tempo_limite INTERVAL;
  data_limite TIMESTAMPTZ;
BEGIN
  -- Buscar dados do ciclo
  SELECT * INTO ciclo_record
  FROM public.prontuario_ciclos
  WHERE id = p_ciclo_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Se já está encerrado, não está em atraso
  IF ciclo_record.status = 'encerrado' THEN
    RETURN false;
  END IF;
  
  -- Buscar configurações
  SELECT * INTO config_record
  FROM public.configuracoes_prontuario
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Configuração padrão: 24 horas
    tempo_limite := INTERVAL '24 hours';
  ELSE
    tempo_limite := (config_record.tempo_limite_horas || ' hours')::INTERVAL;
  END IF;
  
  -- Calcular data limite baseada no início efetivo ou data do ciclo + horário configurado
  IF ciclo_record.data_inicio_efetivo IS NOT NULL THEN
    data_limite := ciclo_record.data_inicio_efetivo + tempo_limite;
  ELSE
    -- Se não tem início efetivo, usar data do ciclo + horário configurado
    data_limite := (ciclo_record.data_ciclo + COALESCE(config_record.horario_inicio_ciclo, '08:00:00'::TIME)) + tempo_limite;
  END IF;
  
  -- Verificar se ultrapassou o tempo limite
  RETURN now() > data_limite;
END;
$$;

-- Função atualizada para criar prontuários considerando horário configurado
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_com_horario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  config_record RECORD;
  horario_inicio TIME;
  data_atual DATE := CURRENT_DATE;
  timestamp_inicio TIMESTAMPTZ;
BEGIN
  -- Buscar configurações mais recentes
  SELECT * INTO config_record
  FROM public.configuracoes_prontuario
  ORDER BY created_at DESC
  LIMIT 1;
  
  horario_inicio := COALESCE(config_record.horario_inicio_ciclo, '08:00:00'::TIME);
  timestamp_inicio := data_atual + horario_inicio;
  
  -- Log da execução
  RAISE NOTICE 'Redefinindo prontuários para % às %', data_atual, horario_inicio;
  
  -- Finalizar automaticamente prontuários em atraso do dia anterior
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      data_encerramento = now(),
      updated_at = now()
  WHERE data_ciclo < data_atual 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos apenas se chegou a hora
  IF now() >= timestamp_inicio THEN
    INSERT INTO prontuario_ciclos (residente_id, data_ciclo, status, data_inicio_efetivo, created_at, updated_at)
    SELECT 
      r.id,
      data_atual,
      'nao_iniciado',
      timestamp_inicio,
      now(),
      now()
    FROM residentes r
    WHERE r.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM prontuario_ciclos pc 
        WHERE pc.residente_id = r.id 
          AND pc.data_ciclo = data_atual
      );
      
    RAISE NOTICE 'Novos prontuários criados para %', data_atual;
  ELSE
    RAISE NOTICE 'Ainda não chegou a hora de criar prontuários (% < %)', now(), timestamp_inicio;
  END IF;
END;
$$;