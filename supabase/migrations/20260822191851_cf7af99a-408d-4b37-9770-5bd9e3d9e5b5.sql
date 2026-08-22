CREATE OR REPLACE FUNCTION public.preencher_horarios_por_escala(p_funcionario_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, deve_trabalhar boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
  v_esc_int_inicio TIME;
  v_esc_int_fim TIME;
BEGIN
  SELECT
    f.data_inicio_vigencia AS data_inicio_vigencia,
    e.nome AS escala_nome,
    e.entrada AS escala_entrada,
    e.saida AS escala_saida,
    e.intervalo_inicio AS escala_intervalo_inicio,
    e.intervalo_fim AS escala_intervalo_fim,
    e.jornada_trabalho AS escala_jornada_trabalho,
    COALESCE(e.intervalo_pre_assinalado, false) AS pre_assinalado
  INTO v_func
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário ou escala não encontrados';
  END IF;

  -- Intervalo só é sugerido quando a escala é pré-assinalada
  IF v_func.pre_assinalado THEN
    v_esc_int_inicio := v_func.escala_intervalo_inicio;
    v_esc_int_fim := v_func.escala_intervalo_fim;
  ELSE
    v_esc_int_inicio := NULL;
    v_esc_int_fim := NULL;
  END IF;

  v_data_vigencia := v_func.data_inicio_vigencia;

  CASE
    WHEN v_func.escala_jornada_trabalho ILIKE '%12x36%' THEN v_total_dias_escala := 2;
    WHEN v_func.escala_jornada_trabalho ILIKE '%6x1%' THEN v_total_dias_escala := 7;
    WHEN v_func.escala_jornada_trabalho ILIKE '%5x2%' THEN v_total_dias_escala := 7;
    WHEN v_func.escala_jornada_trabalho ILIKE '%4x2%' THEN v_total_dias_escala := 6;
    ELSE v_total_dias_escala := 7;
  END CASE;

  v_data_atual := p_data_inicio;
  WHILE v_data_atual <= p_data_fim LOOP
    v_dias_desde_vigencia := v_data_atual - v_data_vigencia;
    v_dia_ciclo := (v_dias_desde_vigencia % COALESCE(v_total_dias_escala, 1)) + 1;

    v_calc_intervalo_inicio := NULL;
    v_calc_intervalo_fim := NULL;

    IF v_func.escala_jornada_trabalho ILIKE '%12x36%' OR v_func.escala_nome ILIKE '%12x36%' OR v_func.escala_nome ILIKE '%12%36%' THEN
      IF v_dia_ciclo % 2 = 1 THEN
        IF v_func.pre_assinalado THEN
          SELECT ia.intervalo_inicio, ia.intervalo_fim
          INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
          FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) AS ia;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada,
          COALESCE(v_esc_int_inicio, v_calc_intervalo_inicio),
          COALESCE(v_esc_int_fim, v_calc_intervalo_fim),
          v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME, FALSE;
      END IF;

    ELSIF v_func.escala_jornada_trabalho ILIKE '%6x1%' OR v_func.escala_nome ILIKE '%6x1%' OR v_func.escala_nome ILIKE '%6%1%' THEN
      IF v_dia_ciclo <= 6 THEN
        IF v_func.pre_assinalado THEN
          SELECT ia.intervalo_inicio, ia.intervalo_fim
          INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
          FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) AS ia;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada,
          COALESCE(v_esc_int_inicio, v_calc_intervalo_inicio),
          COALESCE(v_esc_int_fim, v_calc_intervalo_fim),
          v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME, FALSE;
      END IF;

    ELSIF v_func.escala_jornada_trabalho ILIKE '%5x2%' OR v_func.escala_nome ILIKE '%5x2%' OR v_func.escala_nome ILIKE '%5%2%' THEN
      IF v_dia_ciclo <= 5 THEN
        IF v_func.pre_assinalado THEN
          SELECT ia.intervalo_inicio, ia.intervalo_fim
          INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
          FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) AS ia;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada,
          COALESCE(v_esc_int_inicio, v_calc_intervalo_inicio),
          COALESCE(v_esc_int_fim, v_calc_intervalo_fim),
          v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME, FALSE;
      END IF;

    ELSIF v_func.escala_jornada_trabalho ILIKE '%4x2%' OR v_func.escala_nome ILIKE '%4x2%' OR v_func.escala_nome ILIKE '%4%2%' THEN
      IF v_dia_ciclo <= 4 THEN
        IF v_func.pre_assinalado THEN
          SELECT ia.intervalo_inicio, ia.intervalo_fim
          INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
          FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) AS ia;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada,
          COALESCE(v_esc_int_inicio, v_calc_intervalo_inicio),
          COALESCE(v_esc_int_fim, v_calc_intervalo_fim),
          v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME, FALSE;
      END IF;

    ELSE
      IF (
        (EXTRACT(DOW FROM v_data_atual) = 1 AND v_func.escala_jornada_trabalho ILIKE '%segunda%') OR
        (EXTRACT(DOW FROM v_data_atual) = 2 AND v_func.escala_jornada_trabalho ILIKE '%terca%') OR
        (EXTRACT(DOW FROM v_data_atual) = 3 AND v_func.escala_jornada_trabalho ILIKE '%quarta%') OR
        (EXTRACT(DOW FROM v_data_atual) = 4 AND v_func.escala_jornada_trabalho ILIKE '%quinta%') OR
        (EXTRACT(DOW FROM v_data_atual) = 5 AND v_func.escala_jornada_trabalho ILIKE '%sexta%') OR
        (EXTRACT(DOW FROM v_data_atual) = 6 AND v_func.escala_jornada_trabalho ILIKE '%sabado%') OR
        (EXTRACT(DOW FROM v_data_atual) = 0 AND v_func.escala_jornada_trabalho ILIKE '%domingo%') OR
        v_func.escala_jornada_trabalho ILIKE '%segsex%' AND EXTRACT(DOW FROM v_data_atual) BETWEEN 1 AND 5
      ) THEN
        IF v_func.pre_assinalado THEN
          SELECT ia.intervalo_inicio, ia.intervalo_fim
          INTO v_calc_intervalo_inicio, v_calc_intervalo_fim
          FROM public.inserir_intervalo_automatico(p_funcionario_id, v_data_atual, v_func.escala_entrada, v_func.escala_saida) AS ia;
        END IF;
        RETURN QUERY SELECT v_data_atual, v_func.escala_entrada,
          COALESCE(v_esc_int_inicio, v_calc_intervalo_inicio),
          COALESCE(v_esc_int_fim, v_calc_intervalo_fim),
          v_func.escala_saida, TRUE;
      ELSE
        RETURN QUERY SELECT v_data_atual, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME, FALSE;
      END IF;
    END IF;

    v_data_atual := v_data_atual + 1;
  END LOOP;
END;
$function$;