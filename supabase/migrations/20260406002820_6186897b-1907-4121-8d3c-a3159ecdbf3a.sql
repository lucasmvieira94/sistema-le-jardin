
-- Drop and recreate gerar_folha_ponto_mensal with improved absence detection
DROP FUNCTION IF EXISTS public.calcular_totais_folha_ponto(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.gerar_folha_ponto_mensal(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
RETURNS TABLE(
    funcionario_nome text,
    funcionario_cpf character varying,
    funcionario_funcao text,
    funcionario_escala_nome text,
    funcionario_escala_entrada time without time zone,
    funcionario_escala_saida time without time zone,
    dia integer,
    data date,
    entrada time without time zone,
    intervalo_inicio time without time zone,
    intervalo_fim time without time zone,
    saida time without time zone,
    horas_trabalhadas text,
    horas_extras_diurnas text,
    horas_extras_noturnas text,
    faltas boolean,
    abonos boolean,
    observacoes text
)
LANGUAGE plpgsql
AS $$
DECLARE
    dias_no_mes INTEGER;
    dia_atual INTEGER;
    data_atual DATE;
    funcionario_record RECORD;
    registro_record RECORD;
    afastamento_exists boolean;
    calc_horas_trabalhadas text;
    calc_horas_extras_diurnas text;
    calc_horas_extras_noturnas text;
    calc_faltas boolean;
    calc_abonos boolean;
    dia_semana INTEGER;
    deve_trabalhar boolean;
    jornada text;
    data_vigencia date;
BEGIN
    SELECT 
        f.nome_completo, f.cpf, f.funcao,
        f.data_inicio_vigencia, f.data_admissao,
        e.nome as escala_nome, e.entrada as escala_entrada,
        e.saida as escala_saida, e.intervalo_inicio as escala_intervalo_inicio,
        e.intervalo_fim as escala_intervalo_fim, e.jornada_trabalho
    INTO funcionario_record
    FROM funcionarios f
    JOIN escalas e ON f.escala_id = e.id
    WHERE f.id = p_funcionario_id;

    IF NOT FOUND THEN RETURN; END IF;

    jornada := funcionario_record.jornada_trabalho;
    data_vigencia := COALESCE(funcionario_record.data_inicio_vigencia, funcionario_record.data_admissao);
    dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', DATE(p_ano || '-' || p_mes || '-01')) + INTERVAL '1 month' - INTERVAL '1 day'));

    FOR dia_atual IN 1..dias_no_mes LOOP
        data_atual := DATE(p_ano || '-' || LPAD(p_mes::TEXT, 2, '0') || '-' || LPAD(dia_atual::TEXT, 2, '0'));
        
        calc_horas_trabalhadas := '00:00:00';
        calc_horas_extras_diurnas := '00:00:00';
        calc_horas_extras_noturnas := '00:00:00';
        calc_faltas := false;
        calc_abonos := false;
        
        dia_semana := EXTRACT(DOW FROM data_atual);
        deve_trabalhar := false;
        
        IF jornada = '40h_8h_segsex' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        ELSIF jornada = '44h_8h_segsab' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 6;
        ELSIF jornada = '12x36' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 2 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '24x72' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 4 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '6x1' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 7 != 6;
            ELSE deve_trabalhar := dia_semana BETWEEN 1 AND 6; END IF;
        ELSE
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        END IF;

        IF data_vigencia IS NOT NULL AND data_atual < data_vigencia THEN
            deve_trabalhar := false;
        END IF;
        
        SELECT rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida, rp.observacoes
        INTO registro_record
        FROM registros_ponto rp
        WHERE rp.funcionario_id = p_funcionario_id AND rp.data = data_atual
        LIMIT 1;

        SELECT EXISTS(
            SELECT 1 FROM afastamentos a
            WHERE a.funcionario_id = p_funcionario_id
            AND data_atual BETWEEN a.data_inicio AND COALESCE(a.data_fim, a.data_inicio)
        ) INTO afastamento_exists;

        IF registro_record.observacoes ILIKE '%abono%' THEN
            calc_abonos := true;
        ELSIF registro_record.observacoes ILIKE '%falta%' THEN
            calc_faltas := true;
        ELSIF afastamento_exists THEN
            calc_abonos := true;
        ELSIF registro_record.entrada IS NOT NULL AND registro_record.saida IS NOT NULL THEN
            BEGIN
                SELECT COALESCE(calcular_horas_trabalhadas(registro_record.entrada, registro_record.saida, registro_record.intervalo_inicio, registro_record.intervalo_fim)::text, '00:00:00')
                INTO calc_horas_trabalhadas;
            EXCEPTION WHEN OTHERS THEN calc_horas_trabalhadas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(calcular_horas_extras_diurnas(registro_record.entrada, registro_record.intervalo_inicio, registro_record.intervalo_fim, registro_record.saida, funcionario_record.escala_entrada, funcionario_record.escala_saida)::text, '00:00:00')
                INTO calc_horas_extras_diurnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_extras_diurnas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(calcular_horas_extras_noturnas(
                    registro_record.entrada, registro_record.intervalo_inicio, registro_record.intervalo_fim, registro_record.saida,
                    funcionario_record.escala_entrada, funcionario_record.escala_saida
                )::text, '00:00:00')
                INTO calc_horas_extras_noturnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_extras_noturnas := '00:00:00'; END;
        ELSIF deve_trabalhar AND registro_record.entrada IS NULL AND registro_record.saida IS NULL THEN
            calc_faltas := true;
        END IF;

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
$$;

-- Recreate calcular_totais_folha_ponto
CREATE OR REPLACE FUNCTION public.calcular_totais_folha_ponto(p_funcionario_id uuid, p_mes integer, p_ano integer)
RETURNS TABLE(
    total_horas_trabalhadas text,
    total_horas_extras_diurnas text,
    total_horas_extras_noturnas text,
    total_faltas integer,
    total_abonos integer,
    dias_trabalhados integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  t_trabalhadas INTERVAL := INTERVAL '0 hours';
  t_extras_diurnas INTERVAL := INTERVAL '0 hours';
  t_extras_noturnas INTERVAL := INTERVAL '0 hours';
  c_faltas INTEGER := 0;
  c_abonos INTEGER := 0;
  c_dias INTEGER := 0;
  rec RECORD;
  h INTERVAL;
BEGIN
  FOR rec IN SELECT * FROM public.gerar_folha_ponto_mensal(p_funcionario_id, p_mes, p_ano) LOOP
    IF NOT rec.abonos THEN
      BEGIN
        IF rec.horas_trabalhadas IS NOT NULL AND rec.horas_trabalhadas != '' THEN
          t_trabalhadas := t_trabalhadas + rec.horas_trabalhadas::interval;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END;
      
      BEGIN
        IF rec.horas_extras_diurnas IS NOT NULL AND rec.horas_extras_diurnas != '' THEN
          t_extras_diurnas := t_extras_diurnas + rec.horas_extras_diurnas::interval;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END;
      
      BEGIN
        IF rec.horas_extras_noturnas IS NOT NULL AND rec.horas_extras_noturnas != '' THEN
          t_extras_noturnas := t_extras_noturnas + rec.horas_extras_noturnas::interval;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    
    IF rec.faltas THEN c_faltas := c_faltas + 1; END IF;
    IF rec.abonos THEN c_abonos := c_abonos + 1; END IF;
    IF (rec.entrada IS NOT NULL OR rec.saida IS NOT NULL) AND NOT rec.abonos THEN
      c_dias := c_dias + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT t_trabalhadas::text, t_extras_diurnas::text, t_extras_noturnas::text, c_faltas, c_abonos, c_dias;
END;
$$;
