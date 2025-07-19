-- Função para adicionar intervalo automático baseado na escala do funcionário
CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
RETURNS TRIGGER AS $$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  intervalo_duracao INTERVAL;
  hora_inicio_intervalo TIME;
  hora_fim_intervalo TIME;
BEGIN
  -- Verificar se é uma atualização que adiciona horário de saída
  IF TG_OP = 'UPDATE' AND OLD.saida IS NULL AND NEW.saida IS NOT NULL THEN
    -- Verificar se já tem intervalo registrado
    IF NEW.intervalo_inicio IS NULL AND NEW.intervalo_fim IS NULL THEN
      -- Buscar dados da escala do funcionário
      SELECT e.entrada, e.saida
      INTO escala_entrada, escala_saida
      FROM public.funcionarios f
      JOIN public.escalas e ON f.escala_id = e.id
      WHERE f.id = NEW.funcionario_id;
      
      -- Calcular duração da jornada de trabalho
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para adicionar intervalo automático
DROP TRIGGER IF EXISTS trigger_adicionar_intervalo_automatico ON public.registros_ponto;
CREATE TRIGGER trigger_adicionar_intervalo_automatico
  BEFORE UPDATE ON public.registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.adicionar_intervalo_automatico();