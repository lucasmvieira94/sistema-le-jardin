-- Fix ambiguous column references by fully qualifying and aliasing columns
CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(
  data date,
  entrada time without time zone,
  intervalo_inicio time without time zone,
  intervalo_fim time without time zone,
  saida time without time zone,
  deve_trabalhar boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_func RECORD;
  v_data_vigencia DATE;
  v_data_atual DATE;
  v_dias_desde_vigencia INTEGER;
  v_dia_ciclo INTEGER;
  v_total_dias_escala INTEGER;
  v_intervals RECORD;
BEGIN
  -- Buscar dados do funcionário e escala com aliases explícitos
  SELECT 
    f.data_inicio_vigencia AS data_inicio_vigencia,
    e.nome AS escala_nome,
    e.entrada AS escala_entrada,
    e.saida AS escala_saida,
    e.intervalo_inicio AS escala_intervalo_inicio,
    e.intervalo_fim AS escala_intervalo_fim,
    e.dias_semana AS escala_dias_semana
  INTO v_func
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário ou escala não encontrados';
  END IF;
  
  v_data_vigencia := v_func.data_inicio_vigencia;
  v_total_dias_escala := array_length(v_func.escala_dias_semana, 1);
  
  v_data_atual := p_data_inicio;
  WHILE v_data_atual <= p_data_fim LOOP
    v_dias_desde_vigencia := v_data_atual - v_data_vigencia;
    v_dia_ciclo := (v_dias_desde_vigencia % COALESCE(v_total_dias_escala, 1)) + 1;

    -- Inicializa record de intervalos a cada iteração
    v_intervals := NULL;

    IF v_func.escala_nome ILIKE '%12x36%' OR v_func.escala_nome ILIKE '%12%36%' THEN
      IF v_dia_ciclo % 2 = 1 THEN
        SELECT ia.intervalo_inicio AS calc_intervalo_inicio, ia.intervalo_fim AS calc_intervalo_fim
        INTO v_intervals
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia(intervalo_inicio time without time zone, intervalo_fim time without time zone);

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_intervals.calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_intervals.calc_intervalo_fim),
          v_func.escala_saida,
          TRUE;
      ELSE
        RETURN QUERY SELECT 
          v_data_atual,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          FALSE;
      END IF;

    ELSIF v_func.escala_nome ILIKE '%6x1%' OR v_func.escala_nome ILIKE '%6%1%' THEN
      IF v_dia_ciclo <= 6 THEN
        SELECT ia.intervalo_inicio AS calc_intervalo_inicio, ia.intervalo_fim AS calc_intervalo_fim
        INTO v_intervals
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia(intervalo_inicio time without time zone, intervalo_fim time without time zone);

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_intervals.calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_intervals.calc_intervalo_fim),
          v_func.escala_saida,
          TRUE;
      ELSE
        RETURN QUERY SELECT 
          v_data_atual,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          FALSE;
      END IF;

    ELSIF v_func.escala_nome ILIKE '%5x2%' OR v_func.escala_nome ILIKE '%5%2%' THEN
      IF v_dia_ciclo <= 5 THEN
        SELECT ia.intervalo_inicio AS calc_intervalo_inicio, ia.intervalo_fim AS calc_intervalo_fim
        INTO v_intervals
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia(intervalo_inicio time without time zone, intervalo_fim time without time zone);

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_intervals.calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_intervals.calc_intervalo_fim),
          v_func.escala_saida,
          TRUE;
      ELSE
        RETURN QUERY SELECT 
          v_data_atual,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          FALSE;
      END IF;

    ELSIF v_func.escala_nome ILIKE '%4x2%' OR v_func.escala_nome ILIKE '%4%2%' THEN
      IF v_dia_ciclo <= 4 THEN
        SELECT ia.intervalo_inicio AS calc_intervalo_inicio, ia.intervalo_fim AS calc_intervalo_fim
        INTO v_intervals
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia(intervalo_inicio time without time zone, intervalo_fim time without time zone);

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_intervals.calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_intervals.calc_intervalo_fim),
          v_func.escala_saida,
          TRUE;
      ELSE
        RETURN QUERY SELECT 
          v_data_atual,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          FALSE;
      END IF;

    ELSE
      IF (
        (EXTRACT(DOW FROM v_data_atual) = 0 AND 'Domingo' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 1 AND 'Segunda-feira' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 2 AND 'Terça-feira' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 3 AND 'Quarta-feira' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 4 AND 'Quinta-feira' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 5 AND 'Sexta-feira' = ANY(v_func.escala_dias_semana)) OR
        (EXTRACT(DOW FROM v_data_atual) = 6 AND 'Sábado' = ANY(v_func.escala_dias_semana))
      ) THEN
        SELECT ia.intervalo_inicio AS calc_intervalo_inicio, ia.intervalo_fim AS calc_intervalo_fim
        INTO v_intervals
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia(intervalo_inicio time without time zone, intervalo_fim time without time zone);

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_intervals.calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_intervals.calc_intervalo_fim),
          v_func.escala_saida,
          TRUE;
      ELSE
        RETURN QUERY SELECT 
          v_data_atual,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          NULL::TIME,
          FALSE;
      END IF;
    END IF;

    v_data_atual := v_data_atual + 1;
  END LOOP;
END;
$function$;

-- Keep inserir_intervalo_automatico aligned (no functional change, ensure search_path and qualification)
CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(
  p_funcionario_id uuid,
  p_data date,
  p_entrada time without time zone,
  p_saida time without time zone
)
RETURNS TABLE(intervalo_inicio time without time zone, intervalo_fim time without time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim
  INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;
  
  IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
    RETURN QUERY SELECT escala_intervalo_inicio, escala_intervalo_fim;
    RETURN;
  END IF;
  
  entrada_dt := '2000-01-01'::DATE + p_entrada;
  saida_dt := '2000-01-01'::DATE + p_saida;
  
  IF p_saida < p_entrada THEN
    saida_dt := saida_dt + INTERVAL '1 day';
  END IF;
  
  duracao_jornada := saida_dt - entrada_dt;
  
  IF duracao_jornada > INTERVAL '6 hours' THEN
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '30 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '30 minutes';
  ELSIF duracao_jornada > INTERVAL '4 hours' THEN
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '7.5 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '7.5 minutes';
  ELSE
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    inicio_intervalo_dt::TIME,
    fim_intervalo_dt::TIME;
END;
$function$;