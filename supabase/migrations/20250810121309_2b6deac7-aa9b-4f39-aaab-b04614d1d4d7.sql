-- Fix the record assignment error in preencher_horarios_por_escala function
CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(p_funcionario_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, deve_trabalhar boolean)
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
  v_calc_intervalo_inicio TIME;
  v_calc_intervalo_fim TIME;
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

    -- Reiniciar variáveis de intervalo a cada iteração
    v_calc_intervalo_inicio := NULL;
    v_calc_intervalo_fim := NULL;

    IF v_func.escala_nome ILIKE '%12x36%' OR v_func.escala_nome ILIKE '%12%36%' THEN
      IF v_dia_ciclo % 2 = 1 THEN
        -- Chamar função e capturar os valores retornados
        SELECT ia.intervalo_inicio, ia.intervalo_fim
        INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia;

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_calc_intervalo_fim),
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
        SELECT ia.intervalo_inicio, ia.intervalo_fim
        INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia;

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_calc_intervalo_fim),
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
        SELECT ia.intervalo_inicio, ia.intervalo_fim
        INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia;

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_calc_intervalo_fim),
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
        SELECT ia.intervalo_inicio, ia.intervalo_fim
        INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia;

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_calc_intervalo_fim),
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
        SELECT ia.intervalo_inicio, ia.intervalo_fim
        INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
        FROM public.inserir_intervalo_automatico(
          p_funcionario_id,
          v_data_atual,
          v_func.escala_entrada,
          v_func.escala_saida
        ) AS ia;

        RETURN QUERY SELECT 
          v_data_atual,
          v_func.escala_entrada,
          COALESCE(v_func.escala_intervalo_inicio, v_calc_intervalo_inicio),
          COALESCE(v_func.escala_intervalo_fim, v_calc_intervalo_fim),
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
$function$