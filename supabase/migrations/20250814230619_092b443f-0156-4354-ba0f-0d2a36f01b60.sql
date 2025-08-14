-- Verificar e corrigir todas as funções restantes que precisam de search_path

-- Corrigir adicionar_intervalo_automatico
CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  intervalo_duracao INTERVAL;
  hora_inicio_intervalo TIME;
  hora_fim_intervalo TIME;
BEGIN
  -- Verificar se é uma atualização que adiciona horário de saída
  IF TG_OP = 'UPDATE' AND OLD.saida IS NULL AND NEW.saida IS NOT NULL THEN
    -- Verificar se já tem intervalo registrado
    IF NEW.intervalo_inicio IS NULL AND NEW.intervalo_fim IS NULL THEN
      -- Buscar dados da escala do funcionário
      SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim
      INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim
      FROM public.funcionarios f
      JOIN public.escalas e ON f.escala_id = e.id
      WHERE f.id = NEW.funcionario_id;
      
      -- Se a escala tem intervalo definido, usar esse intervalo
      IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
        NEW.intervalo_inicio := escala_intervalo_inicio;
        NEW.intervalo_fim := escala_intervalo_fim;
      ELSE
        -- Calcular duração da jornada de trabalho e aplicar regra automática
        IF escala_entrada IS NOT NULL AND escala_saida IS NOT NULL THEN
          intervalo_duracao := escala_saida - escala_entrada;
          
          -- Se jornada é maior que 6 horas, adicionar intervalo de 1 hora
          -- Se jornada é maior que 4 horas e menor que 6, adicionar intervalo de 15 minutos
          IF intervalo_duracao > INTERVAL '6 hours' THEN
            -- Adicionar intervalo de 1 hora no meio da jornada
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2 - INTERVAL '30 minutes';
            hora_fim_intervalo := hora_inicio_intervalo + INTERVAL '1 hour';
          ELSIF intervalo_duracao > INTERVAL '4 hours' THEN
            -- Adicionar intervalo de 15 minutos no meio da jornada
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2 - INTERVAL '7.5 minutes';
            hora_fim_intervalo := hora_inicio_intervalo + INTERVAL '15 minutes';
          END IF;
          
          -- Aplicar o intervalo calculado
          IF hora_inicio_intervalo IS NOT NULL AND hora_fim_intervalo IS NOT NULL THEN
            NEW.intervalo_inicio := hora_inicio_intervalo;
            NEW.intervalo_fim := hora_fim_intervalo;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Corrigir processar_afastamento
CREATE OR REPLACE FUNCTION public.processar_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  FROM public.tipos_afastamento ta 
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
        observacoes = COALESCE(public.registros_ponto.observacoes, '') || ' | ' || NEW.observacoes,
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
      observacoes = COALESCE(public.registros_ponto.observacoes, '') || ' | ' || NEW.observacoes || ' (' || NEW.quantidade_horas || 'h)',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;