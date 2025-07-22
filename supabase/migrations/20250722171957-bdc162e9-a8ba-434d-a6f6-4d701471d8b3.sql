-- Adicionar colunas de intervalo na tabela escalas
ALTER TABLE public.escalas 
ADD COLUMN intervalo_inicio TIME,
ADD COLUMN intervalo_fim TIME;

-- Atualizar a função para usar o intervalo da escala quando disponível
CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;