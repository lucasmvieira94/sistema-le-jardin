-- Fix security context for functions that access funcionarios table
-- The error might be caused by functions not having proper search_path

-- Update the function that fills schedules automatically
CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(p_funcionario_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, deve_trabalhar boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  funcionario_record RECORD;
  data_vigencia DATE;
  data_atual DATE;
  dias_desde_vigencia INTEGER;
  dia_ciclo INTEGER;
  total_dias_escala INTEGER;
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
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
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
    
    -- Verificar se deve trabalhar neste dia (baseado no padrão da escala)
    CASE 
      WHEN funcionario_record.escala_nome ILIKE '%12x36%' OR funcionario_record.escala_nome ILIKE '%12%36%' THEN
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
        
      WHEN funcionario_record.escala_nome ILIKE '%6x1%' OR funcionario_record.escala_nome ILIKE '%6%1%' THEN
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
        
      WHEN funcionario_record.escala_nome ILIKE '%5x2%' OR funcionario_record.escala_nome ILIKE '%5%2%' THEN
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
        
      WHEN funcionario_record.escala_nome ILIKE '%4x2%' OR funcionario_record.escala_nome ILIKE '%4%2%' THEN
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
        IF (
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
    
    data_atual := data_atual + 1;
  END LOOP;
END;
$function$;

-- Update the function that inserts automatic intervals
CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(p_funcionario_id uuid, p_data date, p_entrada time without time zone, p_saida time without time zone)
 RETURNS TABLE(intervalo_inicio time without time zone, intervalo_fim time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  duracao_jornada INTERVAL;
  meio_jornada_dt TIMESTAMP;
  inicio_intervalo_dt TIMESTAMP;
  fim_intervalo_dt TIMESTAMP;
  entrada_dt TIMESTAMP;
  saida_dt TIMESTAMP;
BEGIN
  -- Buscar dados da escala do funcionário
  SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim
  INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;
  
  -- Se a escala tem intervalo definido, usar esse intervalo
  IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
    RETURN QUERY SELECT escala_intervalo_inicio, escala_intervalo_fim;
    RETURN;
  END IF;
  
  -- Criar timestamps para calcular duração
  entrada_dt := '2000-01-01'::DATE + p_entrada;
  saida_dt := '2000-01-01'::DATE + p_saida;
  
  -- Se é turno noturno, ajustar saída para o dia seguinte
  IF p_saida < p_entrada THEN
    saida_dt := saida_dt + INTERVAL '1 day';
  END IF;
  
  duracao_jornada := saida_dt - entrada_dt;
  
  -- Aplicar regras de intervalo baseadas na CLT
  IF duracao_jornada > INTERVAL '6 hours' THEN
    -- Jornada acima de 6h: intervalo de 1 hora no meio
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '30 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '30 minutes';
  ELSIF duracao_jornada > INTERVAL '4 hours' THEN
    -- Jornada entre 4-6h: intervalo de 15 minutos no meio
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '7.5 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '7.5 minutes';
  ELSE
    -- Jornada até 4h: sem intervalo obrigatório
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
    RETURN;
  END IF;
  
  -- Extrair apenas o horário dos timestamps calculados
  RETURN QUERY SELECT 
    inicio_intervalo_dt::TIME as intervalo_inicio,
    fim_intervalo_dt::TIME as intervalo_fim;
END;
$function$;