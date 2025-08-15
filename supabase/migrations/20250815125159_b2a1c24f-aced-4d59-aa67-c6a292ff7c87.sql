-- Atualizar função gerar_folha_ponto_mensal para não computar horas de abonos
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(funcionario_nome text, funcionario_cpf text, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas interval, horas_extras_diurnas interval, horas_extras_noturnas interval, faltas boolean, abonos boolean, observacoes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  escala_rec RECORD;
  dia_atual INTEGER;
  data_atual DATE;
  entrada_esperada TIME;
  saida_esperada TIME;
  horas_contratuais INTERVAL;
  horas_trabalhadas_dia INTERVAL;
  horas_noturnas_dia INTERVAL;
  horas_extras_totais INTERVAL;
  is_falta BOOLEAN;
  is_abono BOOLEAN;
BEGIN
  -- Buscar dados do funcionário e escala
  SELECT 
    f.nome_completo,
    f.cpf,
    f.funcao,
    e.nome,
    e.entrada,
    e.saida
  INTO 
    funcionario_nome,
    funcionario_cpf,
    funcionario_funcao,
    funcionario_escala_nome,
    funcionario_escala_entrada,
    funcionario_escala_saida
  FROM funcionarios f
  JOIN escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;

  -- Calcular horas contratuais por dia usando a função para turnos noturnos
  horas_contratuais := public.calcular_horas_trabalhadas_turno_noturno(
    funcionario_escala_entrada, 
    funcionario_escala_saida
  );

  -- Loop para cada dia do mês (1 a 31)
  FOR dia_atual IN 1..31 LOOP
    -- Verificar se o dia existe no mês/ano
    BEGIN
      data_atual := make_date(p_ano, p_mes, dia_atual);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE; -- Pular dias que não existem (ex: 31 de fevereiro)
    END;

    -- Buscar registro de ponto do dia (incluindo turnos noturnos do dia anterior)
    SELECT 
      r.entrada,
      r.intervalo_inicio,
      r.intervalo_fim,
      r.saida,
      r.observacoes,
      r.tipo_registro
    INTO rec
    FROM registros_ponto r
    WHERE r.funcionario_id = p_funcionario_id 
    AND (
      r.data = data_atual OR 
      (r.data = data_atual - 1 AND r.entrada IS NOT NULL AND r.saida IS NOT NULL AND r.saida < r.entrada)
    )
    ORDER BY r.data DESC, r.created_at DESC
    LIMIT 1;

    -- Determinar se é falta ou abono baseado no tipo_registro
    IF rec.tipo_registro = 'falta' THEN
      is_falta := TRUE;
      is_abono := FALSE;
    ELSIF rec.tipo_registro = 'abono' OR rec.tipo_registro = 'falta_abonada' THEN
      is_falta := FALSE;
      is_abono := TRUE;
    ELSIF rec.entrada IS NULL AND rec.saida IS NULL AND rec.tipo_registro IS NULL THEN
      -- Verificar se deveria trabalhar neste dia baseado na escala
      SELECT eh.deve_trabalhar INTO is_falta
      FROM public.preencher_horarios_por_escala(p_funcionario_id, data_atual, data_atual) eh
      WHERE eh.data = data_atual;
      
      is_falta := COALESCE(is_falta, FALSE);
      is_abono := FALSE;
    ELSE
      is_falta := FALSE;
      is_abono := FALSE;
    END IF;

    -- Calcular horas trabalhadas e noturnas do dia
    -- IMPORTANTE: Se é abono, não computar horas trabalhadas reais
    IF rec.entrada IS NOT NULL AND rec.saida IS NOT NULL AND NOT is_abono THEN
      -- Horas trabalhadas totais (apenas se não for abono)
      horas_trabalhadas_dia := public.calcular_horas_trabalhadas_turno_noturno(
        rec.entrada, 
        rec.saida, 
        rec.intervalo_inicio, 
        rec.intervalo_fim
      );
      
      -- Horas noturnas trabalhadas
      horas_noturnas_dia := public.calcular_horas_noturnas(
        rec.entrada,
        rec.saida,
        rec.intervalo_inicio,
        rec.intervalo_fim
      );
    ELSIF is_abono THEN
      -- Para abonos, mostrar as horas contratuais mas não computar como trabalhadas
      horas_trabalhadas_dia := INTERVAL '0 hours';
      horas_noturnas_dia := INTERVAL '0 hours';
    ELSE
      horas_trabalhadas_dia := INTERVAL '0 hours';
      horas_noturnas_dia := INTERVAL '0 hours';
    END IF;

    -- Calcular horas extras (apenas se não for abono)
    IF horas_trabalhadas_dia > horas_contratuais AND NOT is_abono THEN
      horas_extras_totais := horas_trabalhadas_dia - horas_contratuais;
    ELSE
      horas_extras_totais := INTERVAL '0 hours';
    END IF;

    -- Retornar linha para o dia
    RETURN QUERY SELECT
      funcionario_nome,
      funcionario_cpf,
      funcionario_funcao,
      funcionario_escala_nome,
      funcionario_escala_entrada,
      funcionario_escala_saida,
      dia_atual,
      data_atual,
      rec.entrada,
      rec.intervalo_inicio,
      rec.intervalo_fim,
      rec.saida,
      horas_trabalhadas_dia,
      CASE 
        WHEN horas_extras_totais > INTERVAL '0 hours' AND horas_noturnas_dia < horas_extras_totais AND NOT is_abono
        THEN horas_extras_totais - horas_noturnas_dia
        ELSE INTERVAL '0 hours'
      END as horas_extras_diurnas,
      CASE 
        WHEN horas_extras_totais > INTERVAL '0 hours' AND horas_noturnas_dia > INTERVAL '0 hours' AND NOT is_abono
        THEN LEAST(horas_noturnas_dia, horas_extras_totais)
        ELSE INTERVAL '0 hours'
      END as horas_extras_noturnas,
      is_falta,
      is_abono,
      rec.observacoes;
  END LOOP;
END;
$$;

-- Atualizar função calcular_totais_folha_ponto para não incluir abonos no cômputo
CREATE OR REPLACE FUNCTION public.calcular_totais_folha_ponto(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(total_horas_trabalhadas interval, total_horas_extras_diurnas interval, total_horas_extras_noturnas interval, total_faltas integer, total_abonos integer, dias_trabalhados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  total_trabalhadas INTERVAL := INTERVAL '0 hours';
  total_extras_diurnas INTERVAL := INTERVAL '0 hours';
  total_extras_noturnas INTERVAL := INTERVAL '0 hours';
  count_faltas INTEGER := 0;
  count_abonos INTEGER := 0;
  count_dias_trabalhados INTEGER := 0;
  rec RECORD;
BEGIN
  -- Somar todos os dados do mês
  FOR rec IN 
    SELECT * FROM public.gerar_folha_ponto_mensal(p_funcionario_id, p_mes, p_ano)
  LOOP
    -- Apenas somar horas se não for abono
    IF NOT rec.abonos THEN
      total_trabalhadas := total_trabalhadas + COALESCE(rec.horas_trabalhadas, INTERVAL '0 hours');
      total_extras_diurnas := total_extras_diurnas + COALESCE(rec.horas_extras_diurnas, INTERVAL '0 hours');
      total_extras_noturnas := total_extras_noturnas + COALESCE(rec.horas_extras_noturnas, INTERVAL '0 hours');
    END IF;
    
    IF rec.faltas THEN
      count_faltas := count_faltas + 1;
    END IF;
    
    IF rec.abonos THEN
      count_abonos := count_abonos + 1;
    END IF;
    
    -- Contar como dia trabalhado apenas se teve registro real (não abono) ou abono com horários
    IF (rec.entrada IS NOT NULL OR rec.saida IS NOT NULL) AND NOT rec.abonos THEN
      count_dias_trabalhados := count_dias_trabalhados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    total_trabalhadas,
    total_extras_diurnas,
    total_extras_noturnas,
    count_faltas,
    count_abonos,
    count_dias_trabalhados;
END;
$$;