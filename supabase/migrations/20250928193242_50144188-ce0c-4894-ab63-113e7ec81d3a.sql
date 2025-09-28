-- Primeiro, remover as funções existentes
DROP FUNCTION IF EXISTS public.gerar_folha_ponto_mensal(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.calcular_totais_folha_ponto(uuid, integer, integer);

-- Recriar função gerar_folha_ponto_mensal com correções de tipos
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(funcionario_nome text, funcionario_cpf character varying, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas text, horas_extras_diurnas text, horas_extras_noturnas text, faltas boolean, abonos boolean, observacoes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    dias_no_mes INTEGER;
    dia_atual INTEGER;
    data_atual DATE;
    funcionario_record RECORD;
    registro_record RECORD;
BEGIN
    -- Buscar informações do funcionário
    SELECT 
        f.nome_completo,
        f.cpf,
        f.funcao,
        e.nome as escala_nome,
        e.entrada as escala_entrada,
        e.saida as escala_saida
    INTO funcionario_record
    FROM funcionarios f
    JOIN escalas e ON f.escala_id = e.id
    WHERE f.id = p_funcionario_id;

    -- Se funcionário não encontrado, retornar vazio
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calcular dias no mês
    dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', DATE(p_ano || '-' || p_mes || '-01')) + INTERVAL '1 month' - INTERVAL '1 day'));

    -- Loop por todos os dias do mês
    FOR dia_atual IN 1..dias_no_mes LOOP
        data_atual := DATE(p_ano || '-' || LPAD(p_mes::TEXT, 2, '0') || '-' || LPAD(dia_atual::TEXT, 2, '0'));
        
        -- Buscar registro do dia
        SELECT 
            rp.entrada,
            rp.intervalo_inicio,
            rp.intervalo_fim,
            rp.saida,
            rp.observacoes
        INTO registro_record
        FROM registros_ponto rp
        WHERE rp.funcionario_id = p_funcionario_id 
        AND rp.data = data_atual
        LIMIT 1;

        -- Calcular campos derivados
        DECLARE
            calc_horas_trabalhadas text := '00:00:00';
            calc_horas_extras_diurnas text := '00:00:00';
            calc_horas_extras_noturnas text := '00:00:00';
            calc_faltas boolean := false;
            calc_abonos boolean := false;
        BEGIN
            IF registro_record.observacoes ILIKE '%abono%' THEN
                calc_abonos := true;
                calc_horas_trabalhadas := '00:00:00';
                calc_horas_extras_diurnas := '00:00:00';
                calc_horas_extras_noturnas := '00:00:00';
            ELSIF registro_record.observacoes ILIKE '%falta%' THEN
                calc_faltas := true;
                calc_horas_trabalhadas := '00:00:00';
                calc_horas_extras_diurnas := '00:00:00';
                calc_horas_extras_noturnas := '00:00:00';
            ELSIF registro_record.entrada IS NOT NULL AND registro_record.saida IS NOT NULL THEN
                -- Calcular horas trabalhadas
                BEGIN
                    SELECT COALESCE(calcular_horas_trabalhadas(registro_record.entrada, registro_record.saida, registro_record.intervalo_inicio, registro_record.intervalo_fim)::text, '00:00:00')
                    INTO calc_horas_trabalhadas;
                EXCEPTION 
                    WHEN OTHERS THEN 
                        calc_horas_trabalhadas := '00:00:00';
                END;
                
                -- Calcular horas extras diurnas
                BEGIN
                    SELECT COALESCE(calcular_horas_extras_diurnas(registro_record.entrada, registro_record.intervalo_inicio, registro_record.intervalo_fim, registro_record.saida, funcionario_record.escala_entrada, funcionario_record.escala_saida)::text, '00:00:00')
                    INTO calc_horas_extras_diurnas;
                EXCEPTION 
                    WHEN OTHERS THEN 
                        calc_horas_extras_diurnas := '00:00:00';
                END;
                
                -- Calcular horas extras noturnas
                BEGIN
                    SELECT COALESCE(calcular_horas_extras_noturnas(registro_record.entrada, registro_record.intervalo_inicio, registro_record.intervalo_fim, registro_record.saida)::text, '00:00:00')
                    INTO calc_horas_extras_noturnas;
                EXCEPTION 
                    WHEN OTHERS THEN 
                        calc_horas_extras_noturnas := '00:00:00';
                END;
            END IF;
        END;

        -- Retornar resultado
        funcionario_nome := funcionario_record.nome_completo;
        funcionario_cpf := funcionario_record.cpf;
        funcionario_funcao := funcionario_record.funcao;
        funcionario_escala_nome := funcionario_record.escala_nome;
        funcionario_escala_entrada := funcionario_record.escala_entrada;
        funcionario_escala_saida := funcionario_record.escala_saida;
        dia := dia_atual;
        data := data_atual;
        entrada := registro_record.entrada;
        intervalo_inicio := registro_record.intervalo_inicio;
        intervalo_fim := registro_record.intervalo_fim;
        saida := registro_record.saida;
        horas_trabalhadas := calc_horas_trabalhadas;
        horas_extras_diurnas := calc_horas_extras_diurnas;
        horas_extras_noturnas := calc_horas_extras_noturnas;
        faltas := calc_faltas;
        abonos := calc_abonos;
        observacoes := registro_record.observacoes;

        RETURN NEXT;
    END LOOP;
END;
$function$;

-- Recriar função calcular_totais_folha_ponto com correções de tipos
CREATE OR REPLACE FUNCTION public.calcular_totais_folha_ponto(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(total_horas_trabalhadas text, total_horas_extras_diurnas text, total_horas_extras_noturnas text, total_faltas integer, total_abonos integer, dias_trabalhados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_trabalhadas INTERVAL := INTERVAL '0 hours';
  total_extras_diurnas INTERVAL := INTERVAL '0 hours';
  total_extras_noturnas INTERVAL := INTERVAL '0 hours';
  count_faltas INTEGER := 0;
  count_abonos INTEGER := 0;
  count_dias_trabalhados INTEGER := 0;
  rec RECORD;
  horas_interval INTERVAL;
BEGIN
  -- Somar todos os dados do mês
  FOR rec IN 
    SELECT * FROM public.gerar_folha_ponto_mensal(p_funcionario_id, p_mes, p_ano)
  LOOP
    -- Apenas somar horas se não for abono
    IF NOT rec.abonos THEN
      -- Converter text para interval de forma segura
      BEGIN
        IF rec.horas_trabalhadas IS NOT NULL AND rec.horas_trabalhadas != '' THEN
          horas_interval := rec.horas_trabalhadas::interval;
          total_trabalhadas := total_trabalhadas + horas_interval;
        END IF;
      EXCEPTION 
        WHEN OTHERS THEN 
          -- Ignora erro de conversão
          NULL;
      END;
      
      BEGIN
        IF rec.horas_extras_diurnas IS NOT NULL AND rec.horas_extras_diurnas != '' THEN
          horas_interval := rec.horas_extras_diurnas::interval;
          total_extras_diurnas := total_extras_diurnas + horas_interval;
        END IF;
      EXCEPTION 
        WHEN OTHERS THEN 
          -- Ignora erro de conversão
          NULL;
      END;
      
      BEGIN
        IF rec.horas_extras_noturnas IS NOT NULL AND rec.horas_extras_noturnas != '' THEN
          horas_interval := rec.horas_extras_noturnas::interval;
          total_extras_noturnas := total_extras_noturnas + horas_interval;
        END IF;
      EXCEPTION 
        WHEN OTHERS THEN 
          -- Ignora erro de conversão
          NULL;
      END;
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
    total_trabalhadas::text,
    total_extras_diurnas::text,
    total_extras_noturnas::text,
    count_faltas,
    count_abonos,
    count_dias_trabalhados;
END;
$function$;