
-- Criar função para calcular dados da folha de ponto mensal
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(
  p_funcionario_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  funcionario_nome TEXT,
  funcionario_cpf TEXT,
  funcionario_funcao TEXT,
  funcionario_escala_nome TEXT,
  funcionario_escala_entrada TIME,
  funcionario_escala_saida TIME,
  dia INTEGER,
  data DATE,
  entrada TIME,
  intervalo_inicio TIME,
  intervalo_fim TIME,
  saida TIME,
  horas_trabalhadas INTERVAL,
  horas_extras_diurnas INTERVAL,
  horas_extras_noturnas INTERVAL,
  faltas BOOLEAN,
  abonos BOOLEAN,
  observacoes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  dia_atual INTEGER;
  data_atual DATE;
  entrada_esperada TIME;
  saida_esperada TIME;
  horas_contratuais INTERVAL;
  horas_trabalhadas_dia INTERVAL;
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

  -- Calcular horas contratuais por dia
  horas_contratuais := funcionario_escala_saida - funcionario_escala_entrada;

  -- Loop para cada dia do mês
  FOR dia_atual IN 1..31 LOOP
    -- Verificar se o dia existe no mês/ano
    BEGIN
      data_atual := make_date(p_ano, p_mes, dia_atual);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE; -- Pular dias que não existem (ex: 31 de fevereiro)
    END;

    -- Buscar registro de ponto do dia
    SELECT 
      r.entrada,
      r.intervalo_inicio,
      r.intervalo_fim,
      r.saida,
      r.observacoes,
      CASE 
        WHEN r.tipo_registro = 'falta_abonada' THEN TRUE
        ELSE FALSE
      END as is_abono_dia
    INTO rec
    FROM registros_ponto r
    WHERE r.funcionario_id = p_funcionario_id 
    AND r.data = data_atual;

    -- Determinar se é falta ou abono
    IF rec.entrada IS NULL AND rec.saida IS NULL THEN
      is_falta := TRUE;
      is_abono := COALESCE(rec.is_abono_dia, FALSE);
    ELSE
      is_falta := FALSE;
      is_abono := FALSE;
    END IF;

    -- Calcular horas trabalhadas do dia
    IF rec.entrada IS NOT NULL AND rec.saida IS NOT NULL THEN
      horas_trabalhadas_dia := public.calcular_horas_trabalhadas(
        rec.entrada, 
        rec.saida, 
        rec.intervalo_inicio, 
        rec.intervalo_fim
      );
    ELSE
      horas_trabalhadas_dia := INTERVAL '0 hours';
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
        WHEN horas_trabalhadas_dia > horas_contratuais 
        THEN horas_trabalhadas_dia - horas_contratuais
        ELSE INTERVAL '0 hours'
      END as horas_extras_diurnas,
      INTERVAL '0 hours' as horas_extras_noturnas, -- Simplificado por enquanto
      is_falta,
      is_abono,
      rec.observacoes;
  END LOOP;
END;
$$;

-- Criar função para calcular totais mensais
CREATE OR REPLACE FUNCTION public.calcular_totais_folha_ponto(
  p_funcionario_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  total_horas_trabalhadas INTERVAL,
  total_horas_extras_diurnas INTERVAL,
  total_horas_extras_noturnas INTERVAL,
  total_faltas INTEGER,
  total_abonos INTEGER,
  dias_trabalhados INTEGER
)
LANGUAGE plpgsql
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
    total_trabalhadas := total_trabalhadas + COALESCE(rec.horas_trabalhadas, INTERVAL '0 hours');
    total_extras_diurnas := total_extras_diurnas + COALESCE(rec.horas_extras_diurnas, INTERVAL '0 hours');
    total_extras_noturnas := total_extras_noturnas + COALESCE(rec.horas_extras_noturnas, INTERVAL '0 hours');
    
    IF rec.faltas THEN
      count_faltas := count_faltas + 1;
    END IF;
    
    IF rec.abonos THEN
      count_abonos := count_abonos + 1;
    END IF;
    
    IF rec.entrada IS NOT NULL OR rec.saida IS NOT NULL THEN
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
