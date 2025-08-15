-- Corrigir search_path para funções de segurança
CREATE OR REPLACE FUNCTION public.calcular_horas_noturnas(
  p_entrada TIME,
  p_saida TIME,
  p_intervalo_inicio TIME DEFAULT NULL,
  p_intervalo_fim TIME DEFAULT NULL
) RETURNS INTERVAL
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inicio_noturno TIME := '22:00:00';
  fim_noturno TIME := '05:00:00';
  entrada_dt TIMESTAMP;
  saida_dt TIMESTAMP;
  intervalo_inicio_dt TIMESTAMP;
  intervalo_fim_dt TIMESTAMP;
  horas_noturnas INTERVAL := INTERVAL '0 hours';
  periodo_noturno_inicio TIMESTAMP;
  periodo_noturno_fim TIMESTAMP;
BEGIN
  -- Se não há entrada ou saída, retorna 0
  IF p_entrada IS NULL OR p_saida IS NULL THEN
    RETURN INTERVAL '0 hours';
  END IF;
  
  -- Criar timestamps base para o cálculo
  entrada_dt := '2000-01-01'::DATE + p_entrada;
  saida_dt := '2000-01-01'::DATE + p_saida;
  
  -- Se saída é menor que entrada, é turno noturno (vai para o dia seguinte)
  IF p_saida < p_entrada THEN
    saida_dt := saida_dt + INTERVAL '1 day';
  END IF;
  
  -- Período noturno: 22h do dia atual até 5h do dia seguinte
  periodo_noturno_inicio := '2000-01-01'::DATE + inicio_noturno;
  periodo_noturno_fim := '2000-01-02'::DATE + fim_noturno;
  
  -- Calcular interseção do turno de trabalho com período noturno
  
  -- Caso 1: Trabalho das 22h às 5h (totalmente noturno)
  IF entrada_dt >= periodo_noturno_inicio OR saida_dt <= periodo_noturno_fim THEN
    -- Início do trabalho noturno
    IF entrada_dt >= periodo_noturno_inicio THEN
      -- Trabalho começou no período noturno da noite
      IF saida_dt <= periodo_noturno_fim THEN
        -- Terminou no período noturno da madrugada
        horas_noturnas := saida_dt - entrada_dt;
      ELSE
        -- Terminou depois do período noturno
        horas_noturnas := periodo_noturno_fim - entrada_dt;
      END IF;
    ELSE
      -- Trabalho começou antes das 22h
      IF saida_dt <= periodo_noturno_fim THEN
        -- Terminou no período noturno da madrugada
        horas_noturnas := saida_dt - periodo_noturno_inicio;
      ELSE
        -- Passou por todo o período noturno
        horas_noturnas := periodo_noturno_fim - periodo_noturno_inicio;
      END IF;
    END IF;
  END IF;
  
  -- Caso 2: Para turnos que cruzam meia-noite mas não são totalmente noturnos
  IF entrada_dt < periodo_noturno_inicio AND saida_dt > periodo_noturno_fim THEN
    -- O turno cobre todo o período noturno
    horas_noturnas := periodo_noturno_fim - periodo_noturno_inicio;
  ELSIF entrada_dt < periodo_noturno_inicio AND saida_dt > periodo_noturno_inicio AND saida_dt <= periodo_noturno_fim THEN
    -- Turno começou antes das 22h e terminou durante o período noturno
    horas_noturnas := saida_dt - periodo_noturno_inicio;
  ELSIF entrada_dt >= periodo_noturno_inicio AND entrada_dt < periodo_noturno_fim AND saida_dt > periodo_noturno_fim THEN
    -- Turno começou durante período noturno e terminou depois
    horas_noturnas := periodo_noturno_fim - entrada_dt;
  END IF;
  
  -- Subtrair intervalo se estiver dentro do período noturno
  IF p_intervalo_inicio IS NOT NULL AND p_intervalo_fim IS NOT NULL THEN
    intervalo_inicio_dt := '2000-01-01'::DATE + p_intervalo_inicio;
    intervalo_fim_dt := '2000-01-01'::DATE + p_intervalo_fim;
    
    -- Ajustar intervalo se cruza meia-noite
    IF p_intervalo_fim < p_intervalo_inicio THEN
      intervalo_fim_dt := intervalo_fim_dt + INTERVAL '1 day';
    END IF;
    
    -- Verificar se intervalo está no período noturno
    IF (intervalo_inicio_dt >= periodo_noturno_inicio AND intervalo_inicio_dt < periodo_noturno_fim) OR
       (intervalo_fim_dt > periodo_noturno_inicio AND intervalo_fim_dt <= periodo_noturno_fim) THEN
      
      -- Calcular quanto do intervalo está no período noturno
      DECLARE
        intervalo_noturno_inicio TIMESTAMP;
        intervalo_noturno_fim TIMESTAMP;
        duracao_intervalo_noturno INTERVAL;
      BEGIN
        intervalo_noturno_inicio := GREATEST(intervalo_inicio_dt, periodo_noturno_inicio);
        intervalo_noturno_fim := LEAST(intervalo_fim_dt, periodo_noturno_fim);
        
        IF intervalo_noturno_fim > intervalo_noturno_inicio THEN
          duracao_intervalo_noturno := intervalo_noturno_fim - intervalo_noturno_inicio;
          horas_noturnas := horas_noturnas - duracao_intervalo_noturno;
        END IF;
      END;
    END IF;
  END IF;
  
  -- Garantir que não seja negativo
  IF horas_noturnas < INTERVAL '0 hours' THEN
    horas_noturnas := INTERVAL '0 hours';
  END IF;
  
  RETURN horas_noturnas;
END;
$$;

-- Atualizar função gerar_folha_ponto_mensal para calcular horas noturnas corretamente
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
    IF rec.entrada IS NOT NULL AND rec.saida IS NOT NULL THEN
      -- Horas trabalhadas totais
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
    ELSE
      horas_trabalhadas_dia := INTERVAL '0 hours';
      horas_noturnas_dia := INTERVAL '0 hours';
    END IF;

    -- Calcular horas extras
    IF horas_trabalhadas_dia > horas_contratuais THEN
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
        WHEN horas_extras_totais > INTERVAL '0 hours' AND horas_noturnas_dia < horas_extras_totais
        THEN horas_extras_totais - horas_noturnas_dia
        ELSE INTERVAL '0 hours'
      END as horas_extras_diurnas,
      CASE 
        WHEN horas_extras_totais > INTERVAL '0 hours' AND horas_noturnas_dia > INTERVAL '0 hours'
        THEN LEAST(horas_noturnas_dia, horas_extras_totais)
        ELSE INTERVAL '0 hours'
      END as horas_extras_noturnas,
      is_falta,
      is_abono,
      rec.observacoes;
  END LOOP;
END;
$$;