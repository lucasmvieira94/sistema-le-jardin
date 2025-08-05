-- Função para preencher horários baseado na escala e vigência do funcionário
CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(
  p_funcionario_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
) RETURNS TABLE(
  data DATE,
  entrada TIME,
  intervalo_inicio TIME,
  intervalo_fim TIME,
  saida TIME,
  deve_trabalhar BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  escala_record RECORD;
  funcionario_record RECORD;
  data_vigencia DATE;
  data_atual DATE;
  dias_desde_vigencia INTEGER;
  dia_ciclo INTEGER;
  total_dias_escala INTEGER;
  dia_semana_escala TEXT;
  intervalos RECORD;
BEGIN
  -- Buscar dados do funcionário e escala
  SELECT 
    f.data_inicio_vigencia,
    e.nome as escala_nome,
    e.entrada,
    e.saida,
    e.intervalo_inicio,
    e.intervalo_fim,
    e.dias_semana
  INTO funcionario_record
  FROM funcionarios f
  JOIN escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário ou escala não encontrados';
  END IF;
  
  data_vigencia := funcionario_record.data_inicio_vigencia;
  total_dias_escala := array_length(funcionario_record.dias_semana, 1);
  
  -- Iterar por cada data no período
  data_atual := p_data_inicio;
  WHILE data_atual <= p_data_fim LOOP
    -- Calcular dias desde o início da vigência
    dias_desde_vigencia := data_atual - data_vigencia;
    
    -- Determinar posição no ciclo da escala (1-based)
    dia_ciclo := (dias_desde_vigencia % total_dias_escala) + 1;
    
    -- Obter o dia da escala correspondente
    dia_semana_escala := funcionario_record.dias_semana[dia_ciclo];
    
    -- Verificar se deve trabalhar neste dia (baseado no padrão da escala)
    IF dia_semana_escala IS NOT NULL THEN
      -- Lógica para determinar se é dia de trabalho baseado no tipo de escala
      CASE 
        WHEN funcionario_record.escala_nome ILIKE '%12x36%' THEN
          -- Escala 12x36: trabalha 1 dia, folga 1 dia
          IF dia_ciclo % 2 = 1 THEN
            -- Dia de trabalho: calcular intervalos automáticos
            SELECT intervalo_inicio, intervalo_fim 
            INTO intervalos
            FROM public.inserir_intervalo_automatico(
              p_funcionario_id,
              data_atual,
              funcionario_record.entrada,
              funcionario_record.saida
            );
            
            RETURN QUERY SELECT 
              data_atual,
              funcionario_record.entrada,
              COALESCE(funcionario_record.intervalo_inicio, intervalos.intervalo_inicio),
              COALESCE(funcionario_record.intervalo_fim, intervalos.intervalo_fim),
              funcionario_record.saida,
              TRUE as deve_trabalhar;
          ELSE
            -- Dia de folga
            RETURN QUERY SELECT 
              data_atual,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              FALSE as deve_trabalhar;
          END IF;
          
        WHEN funcionario_record.escala_nome ILIKE '%6x1%' THEN
          -- Escala 6x1: trabalha 6 dias, folga 1 dia
          IF dia_ciclo <= 6 THEN
            -- Dia de trabalho
            SELECT intervalo_inicio, intervalo_fim 
            INTO intervalos
            FROM public.inserir_intervalo_automatico(
              p_funcionario_id,
              data_atual,
              funcionario_record.entrada,
              funcionario_record.saida
            );
            
            RETURN QUERY SELECT 
              data_atual,
              funcionario_record.entrada,
              COALESCE(funcionario_record.intervalo_inicio, intervalos.intervalo_inicio),
              COALESCE(funcionario_record.intervalo_fim, intervalos.intervalo_fim),
              funcionario_record.saida,
              TRUE as deve_trabalhar;
          ELSE
            -- Dia de folga
            RETURN QUERY SELECT 
              data_atual,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              FALSE as deve_trabalhar;
          END IF;
          
        WHEN funcionario_record.escala_nome ILIKE '%5x2%' THEN
          -- Escala 5x2: trabalha 5 dias, folga 2 dias
          IF dia_ciclo <= 5 THEN
            -- Dia de trabalho
            SELECT intervalo_inicio, intervalo_fim 
            INTO intervalos
            FROM public.inserir_intervalo_automatico(
              p_funcionario_id,
              data_atual,
              funcionario_record.entrada,
              funcionario_record.saida
            );
            
            RETURN QUERY SELECT 
              data_atual,
              funcionario_record.entrada,
              COALESCE(funcionario_record.intervalo_inicio, intervalos.intervalo_inicio),
              COALESCE(funcionario_record.intervalo_fim, intervalos.intervalo_fim),
              funcionario_record.saida,
              TRUE as deve_trabalhar;
          ELSE
            -- Dia de folga
            RETURN QUERY SELECT 
              data_atual,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              FALSE as deve_trabalhar;
          END IF;
          
        WHEN funcionario_record.escala_nome ILIKE '%4x2%' THEN
          -- Escala 4x2: trabalha 4 dias, folga 2 dias
          IF dia_ciclo <= 4 THEN
            -- Dia de trabalho
            SELECT intervalo_inicio, intervalo_fim 
            INTO intervalos
            FROM public.inserir_intervalo_automatico(
              p_funcionario_id,
              data_atual,
              funcionario_record.entrada,
              funcionario_record.saida
            );
            
            RETURN QUERY SELECT 
              data_atual,
              funcionario_record.entrada,
              COALESCE(funcionario_record.intervalo_inicio, intervalos.intervalo_inicio),
              COALESCE(funcionario_record.intervalo_fim, intervalos.intervalo_fim),
              funcionario_record.saida,
              TRUE as deve_trabalhar;
          ELSE
            -- Dia de folga
            RETURN QUERY SELECT 
              data_atual,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              FALSE as deve_trabalhar;
          END IF;
          
        ELSE
          -- Escala padrão: considera os dias da semana tradicionalmente
          -- Se o dia da semana atual está na lista de dias da escala, trabalha
          IF EXTRACT(DOW FROM data_atual)::TEXT = ANY(
            CASE 
              WHEN 'Domingo' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 0 THEN ARRAY['0']
              WHEN 'Segunda-feira' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 1 THEN ARRAY['1']
              WHEN 'Terça-feira' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 2 THEN ARRAY['2']
              WHEN 'Quarta-feira' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 3 THEN ARRAY['3']
              WHEN 'Quinta-feira' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 4 THEN ARRAY['4']
              WHEN 'Sexta-feira' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 5 THEN ARRAY['5']
              WHEN 'Sábado' = ANY(funcionario_record.dias_semana) AND EXTRACT(DOW FROM data_atual) = 6 THEN ARRAY['6']
              ELSE ARRAY[]::TEXT[]
            END
          ) OR (
            (EXTRACT(DOW FROM data_atual) = 0 AND 'Domingo' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 1 AND 'Segunda-feira' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 2 AND 'Terça-feira' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 3 AND 'Quarta-feira' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 4 AND 'Quinta-feira' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 5 AND 'Sexta-feira' = ANY(funcionario_record.dias_semana)) OR
            (EXTRACT(DOW FROM data_atual) = 6 AND 'Sábado' = ANY(funcionario_record.dias_semana))
          ) THEN
            -- Dia de trabalho
            SELECT intervalo_inicio, intervalo_fim 
            INTO intervalos
            FROM public.inserir_intervalo_automatico(
              p_funcionario_id,
              data_atual,
              funcionario_record.entrada,
              funcionario_record.saida
            );
            
            RETURN QUERY SELECT 
              data_atual,
              funcionario_record.entrada,
              COALESCE(funcionario_record.intervalo_inicio, intervalos.intervalo_inicio),
              COALESCE(funcionario_record.intervalo_fim, intervalos.intervalo_fim),
              funcionario_record.saida,
              TRUE as deve_trabalhar;
          ELSE
            -- Dia de folga
            RETURN QUERY SELECT 
              data_atual,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              NULL::TIME,
              FALSE as deve_trabalhar;
          END IF;
      END CASE;
    ELSE
      -- Dia sem informação na escala - considera folga
      RETURN QUERY SELECT 
        data_atual,
        NULL::TIME,
        NULL::TIME,
        NULL::TIME,
        NULL::TIME,
        FALSE as deve_trabalhar;
    END IF;
    
    data_atual := data_atual + 1;
  END LOOP;
END;
$$;