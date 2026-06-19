
-- 1) Novo campo na tabela escalas
ALTER TABLE public.escalas
  ADD COLUMN IF NOT EXISTS intervalo_pre_assinalado boolean NOT NULL DEFAULT false;

-- 2) Novo campo na tabela registros_ponto (lista de pausas)
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS intervalos_pausas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3) Função auxiliar: somar duração total de uma lista de pausas [{inicio,fim}]
CREATE OR REPLACE FUNCTION public.somar_pausas(p_pausas jsonb)
RETURNS interval
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  total interval := interval '0';
  item jsonb;
  ini time;
  fim time;
  dur interval;
BEGIN
  IF p_pausas IS NULL OR jsonb_typeof(p_pausas) <> 'array' THEN
    RETURN interval '0';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_pausas) LOOP
    BEGIN
      ini := NULLIF(item->>'inicio','')::time;
      fim := NULLIF(item->>'fim','')::time;
      IF ini IS NOT NULL AND fim IS NOT NULL THEN
        IF fim < ini THEN
          dur := ('2000-01-02'::date + fim) - ('2000-01-01'::date + ini);
        ELSE
          dur := fim - ini;
        END IF;
        total := total + dur;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- ignora entrada malformada
      NULL;
    END;
  END LOOP;
  RETURN total;
END;
$$;

-- 4) Atualiza gerar_folha_ponto_mensal para considerar:
--    - escala.intervalo_pre_assinalado (desconta intervalo da escala automaticamente)
--    - registros_ponto.intervalos_pausas (soma várias pausas)
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(funcionario_nome text, funcionario_cpf character varying, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas text, horas_extras_diurnas text, horas_extras_noturnas text, faltas boolean, abonos boolean, observacoes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    dias_no_mes INTEGER;
    dia_atual INTEGER;
    data_atual DATE;
    funcionario_record RECORD;
    registro_record RECORD;
    afastamento_exists boolean;
    calc_horas_trabalhadas text;
    calc_horas_extras_diurnas text;
    calc_horas_noturnas text;
    calc_faltas boolean;
    calc_abonos boolean;
    dia_semana INTEGER;
    deve_trabalhar boolean;
    jornada text;
    data_vigencia date;
    data_deslig date;
    eff_intervalo_inicio time;
    eff_intervalo_fim   time;
    pausas_total interval;
    bruto interval;
    liquido interval;
BEGIN
    SELECT 
        f.nome_completo, f.cpf, f.funcao,
        f.data_inicio_vigencia, f.data_admissao, f.data_desligamento,
        e.nome as escala_nome, e.entrada as escala_entrada,
        e.saida as escala_saida, e.intervalo_inicio as escala_intervalo_inicio,
        e.intervalo_fim as escala_intervalo_fim, e.jornada_trabalho,
        COALESCE(e.intervalo_pre_assinalado, false) AS intervalo_pre_assinalado
    INTO funcionario_record
    FROM funcionarios f
    JOIN escalas e ON f.escala_id = e.id
    WHERE f.id = p_funcionario_id;

    IF NOT FOUND THEN RETURN; END IF;

    jornada := funcionario_record.jornada_trabalho;
    data_vigencia := COALESCE(funcionario_record.data_inicio_vigencia, funcionario_record.data_admissao);
    data_deslig := funcionario_record.data_desligamento;
    dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', DATE(p_ano || '-' || p_mes || '-01')) + INTERVAL '1 month' - INTERVAL '1 day'));

    FOR dia_atual IN 1..dias_no_mes LOOP
        data_atual := DATE(p_ano || '-' || LPAD(p_mes::TEXT, 2, '0') || '-' || LPAD(dia_atual::TEXT, 2, '0'));
        
        calc_horas_trabalhadas := '00:00:00';
        calc_horas_extras_diurnas := '00:00:00';
        calc_horas_noturnas := '00:00:00';
        calc_faltas := false;
        calc_abonos := false;
        
        dia_semana := EXTRACT(DOW FROM data_atual);
        deve_trabalhar := false;
        
        IF jornada = '40h_8h_segsex' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        ELSIF jornada = '44h_8h_segsab' OR jornada = '44h_8h_segsex_4h_sab' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 6;
        ELSIF jornada = '12x36' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 2 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '24x72' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 4 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '6x1' OR jornada = '36h_6h_seg_sab' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 7 != 6;
            ELSE deve_trabalhar := dia_semana BETWEEN 1 AND 6; END IF;
        ELSE
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        END IF;

        IF data_vigencia IS NOT NULL AND data_atual < data_vigencia THEN
            deve_trabalhar := false;
        END IF;

        IF data_deslig IS NOT NULL AND data_atual > data_deslig THEN
            deve_trabalhar := false;
        END IF;
        
        SELECT rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida, rp.observacoes, rp.intervalos_pausas
        INTO registro_record
        FROM registros_ponto rp
        WHERE rp.funcionario_id = p_funcionario_id AND rp.data = data_atual
        LIMIT 1;

        SELECT EXISTS(
            SELECT 1 FROM afastamentos a
            WHERE a.funcionario_id = p_funcionario_id
            AND data_atual BETWEEN a.data_inicio AND COALESCE(a.data_fim, a.data_inicio)
        ) INTO afastamento_exists;

        -- Determina intervalo efetivo a ser exibido
        eff_intervalo_inicio := registro_record.intervalo_inicio;
        eff_intervalo_fim   := registro_record.intervalo_fim;

        IF funcionario_record.intervalo_pre_assinalado THEN
            -- usa intervalo da escala (pré-assinalado)
            eff_intervalo_inicio := funcionario_record.escala_intervalo_inicio;
            eff_intervalo_fim   := funcionario_record.escala_intervalo_fim;
        END IF;

        IF registro_record.observacoes ILIKE '%abono%' THEN
            calc_abonos := true;
        ELSIF registro_record.observacoes ILIKE '%falta%' THEN
            calc_faltas := true;
        ELSIF afastamento_exists THEN
            calc_abonos := true;
        ELSIF registro_record.entrada IS NOT NULL AND registro_record.saida IS NOT NULL THEN
            BEGIN
                -- Cálculo bruto (entrada->saida)
                IF registro_record.saida < registro_record.entrada THEN
                    bruto := ('2000-01-02'::date + registro_record.saida) - ('2000-01-01'::date + registro_record.entrada);
                ELSE
                    bruto := registro_record.saida - registro_record.entrada;
                END IF;

                IF funcionario_record.intervalo_pre_assinalado
                   AND funcionario_record.escala_intervalo_inicio IS NOT NULL
                   AND funcionario_record.escala_intervalo_fim IS NOT NULL THEN
                    -- desconta intervalo da escala
                    IF funcionario_record.escala_intervalo_fim < funcionario_record.escala_intervalo_inicio THEN
                        liquido := bruto - (('2000-01-02'::date + funcionario_record.escala_intervalo_fim) - ('2000-01-01'::date + funcionario_record.escala_intervalo_inicio));
                    ELSE
                        liquido := bruto - (funcionario_record.escala_intervalo_fim - funcionario_record.escala_intervalo_inicio);
                    END IF;
                ELSIF registro_record.intervalos_pausas IS NOT NULL
                      AND jsonb_typeof(registro_record.intervalos_pausas) = 'array'
                      AND jsonb_array_length(registro_record.intervalos_pausas) > 0 THEN
                    -- desconta a soma das pausas registradas
                    pausas_total := public.somar_pausas(registro_record.intervalos_pausas);
                    liquido := bruto - pausas_total;
                ELSE
                    -- usa par intervalo_inicio/intervalo_fim legado
                    liquido := public.calcular_horas_trabalhadas(
                        registro_record.entrada, registro_record.saida,
                        registro_record.intervalo_inicio, registro_record.intervalo_fim);
                END IF;

                IF liquido < interval '0' THEN liquido := interval '0'; END IF;
                calc_horas_trabalhadas := liquido::text;
            EXCEPTION WHEN OTHERS THEN calc_horas_trabalhadas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(public.calcular_horas_extras_diurnas(
                    registro_record.entrada, eff_intervalo_inicio, eff_intervalo_fim,
                    registro_record.saida,
                    funcionario_record.escala_entrada, funcionario_record.escala_saida)::text, '00:00:00')
                INTO calc_horas_extras_diurnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_extras_diurnas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(public.calcular_horas_noturnas(
                    registro_record.entrada, registro_record.saida, 
                    eff_intervalo_inicio, eff_intervalo_fim
                )::text, '00:00:00')
                INTO calc_horas_noturnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_noturnas := '00:00:00'; END;
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
        intervalo_inicio := eff_intervalo_inicio;
        intervalo_fim := eff_intervalo_fim;
        saida := registro_record.saida;
        horas_trabalhadas := calc_horas_trabalhadas;
        horas_extras_diurnas := calc_horas_extras_diurnas;
        horas_extras_noturnas := calc_horas_noturnas;
        faltas := calc_faltas;
        abonos := calc_abonos;
        observacoes := registro_record.observacoes;

        RETURN NEXT;
    END LOOP;
END;
$function$;
