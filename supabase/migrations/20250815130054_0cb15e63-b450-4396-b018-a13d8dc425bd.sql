-- Corrigir duplicação de registros noturnos na folha de ponto
CREATE OR REPLACE FUNCTION gerar_folha_ponto_mensal(
    p_funcionario_id UUID,
    p_mes INTEGER,
    p_ano INTEGER
)
RETURNS TABLE (
    funcionario_nome TEXT,
    funcionario_cpf VARCHAR,
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
    horas_trabalhadas TEXT,
    horas_extras_diurnas TEXT,
    horas_extras_noturnas TEXT,
    faltas BOOLEAN,
    abonos BOOLEAN,
    observacoes TEXT
) LANGUAGE plpgsql AS $$
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

    -- Calcular dias no mês
    dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', DATE(p_ano || '-' || p_mes || '-01')) + INTERVAL '1 month' - INTERVAL '1 day'));

    -- Loop por todos os dias do mês
    FOR dia_atual IN 1..dias_no_mes LOOP
        data_atual := DATE(p_ano || '-' || LPAD(p_mes::TEXT, 2, '0') || '-' || LPAD(dia_atual::TEXT, 2, '0'));
        
        -- Buscar registro do dia (usando apenas a data, não importa se é horário noturno)
        SELECT 
            rp.entrada,
            rp.intervalo_inicio,
            rp.intervalo_fim,
            rp.saida,
            CASE 
                WHEN rp.observacoes ILIKE '%abono%' THEN '00:00:00'
                ELSE COALESCE(calcular_horas_trabalhadas(rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida), '00:00:00')
            END as horas_trabalhadas,
            CASE 
                WHEN rp.observacoes ILIKE '%abono%' THEN '00:00:00'
                ELSE COALESCE(calcular_horas_extras_diurnas(rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida, funcionario_record.escala_entrada, funcionario_record.escala_saida), '00:00:00')
            END as horas_extras_diurnas,
            CASE 
                WHEN rp.observacoes ILIKE '%abono%' THEN '00:00:00'
                ELSE COALESCE(calcular_horas_extras_noturnas(rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida), '00:00:00')
            END as horas_extras_noturnas,
            CASE WHEN rp.observacoes ILIKE '%falta%' THEN true ELSE false END as faltas,
            CASE WHEN rp.observacoes ILIKE '%abono%' THEN true ELSE false END as abonos,
            rp.observacoes
        INTO registro_record
        FROM registros_ponto rp
        WHERE rp.funcionario_id = p_funcionario_id 
        AND rp.data = data_atual
        LIMIT 1; -- Garantir apenas um registro por dia

        -- Retornar a linha do dia
        RETURN NEXT (
            funcionario_record.nome_completo,
            funcionario_record.cpf,
            funcionario_record.funcao,
            funcionario_record.escala_nome,
            funcionario_record.escala_entrada,
            funcionario_record.escala_saida,
            dia_atual,
            data_atual,
            registro_record.entrada,
            registro_record.intervalo_inicio,
            registro_record.intervalo_fim,
            registro_record.saida,
            COALESCE(registro_record.horas_trabalhadas, '00:00:00'),
            COALESCE(registro_record.horas_extras_diurnas, '00:00:00'),
            COALESCE(registro_record.horas_extras_noturnas, '00:00:00'),
            COALESCE(registro_record.faltas, false),
            COALESCE(registro_record.abonos, false),
            registro_record.observacoes
        );
    END LOOP;
END;
$$;