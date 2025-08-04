-- Atualizar função de geração de folha de ponto para suportar turnos noturnos
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(funcionario_nome text, funcionario_cpf text, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas interval, horas_extras_diurnas interval, horas_extras_noturnas interval, faltas boolean, abonos boolean, observacoes text)
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

  -- Calcular horas contratuais por dia usando a nova função para turnos noturnos
  horas_contratuais := public.calcular_horas_trabalhadas_turno_noturno(
    funcionario_escala_entrada, 
    funcionario_escala_saida
  );

  -- Loop para cada dia do mês
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
      CASE 
        WHEN r.tipo_registro = 'falta_abonada' THEN TRUE
        ELSE FALSE
      END as is_abono_dia
    INTO rec
    FROM registros_ponto r
    WHERE r.funcionario_id = p_funcionario_id 
    AND (
      r.data = data_atual OR 
      (r.data = data_atual - 1 AND r.entrada IS NOT NULL AND r.saida IS NOT NULL AND r.saida < r.entrada)
    )
    ORDER BY r.data DESC, r.created_at DESC
    LIMIT 1;

    -- Determinar se é falta ou abono
    IF rec.entrada IS NULL AND rec.saida IS NULL THEN
      is_falta := TRUE;
      is_abono := COALESCE(rec.is_abono_dia, FALSE);
    ELSE
      is_falta := FALSE;
      is_abono := FALSE;
    END IF;

    -- Calcular horas trabalhadas do dia usando a nova função para turnos noturnos
    IF rec.entrada IS NOT NULL AND rec.saida IS NOT NULL THEN
      horas_trabalhadas_dia := public.calcular_horas_trabalhadas_turno_noturno(
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