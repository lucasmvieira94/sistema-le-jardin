
-- Primeiro, remover a função existente
DROP FUNCTION IF EXISTS public.gerar_folha_ponto_mensal(UUID, INTEGER, INTEGER);

-- Corrigir a função calcular_horas_extras_diurnas para lidar com turnos noturnos
CREATE OR REPLACE FUNCTION public.calcular_horas_extras_diurnas(
  p_entrada TIME,
  p_intervalo_inicio TIME,
  p_intervalo_fim TIME,
  p_saida TIME,
  p_escala_entrada TIME,
  p_escala_saida TIME
)
RETURNS INTERVAL
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  horas_trabalhadas INTERVAL;
  horas_escala INTERVAL;
  horas_extras INTERVAL := INTERVAL '0 hours';
  horas_noturnas INTERVAL;
  horas_noturnas_escala INTERVAL;
  intervalo_escala INTERVAL;
BEGIN
  -- Se não há entrada ou saída, retorna 0
  IF p_entrada IS NULL OR p_saida IS NULL OR p_escala_entrada IS NULL OR p_escala_saida IS NULL THEN
    RETURN INTERVAL '0 hours';
  END IF;
  
  -- Calcular horas trabalhadas
  horas_trabalhadas := calcular_horas_trabalhadas(p_entrada, p_saida, p_intervalo_inicio, p_intervalo_fim);
  
  -- Calcular horas da escala considerando turnos noturnos
  -- Se a saída é MENOR que a entrada, é turno noturno (cruza meia-noite)
  IF p_escala_saida < p_escala_entrada THEN
    -- Turno noturno: soma 24h à diferença negativa
    horas_escala := (INTERVAL '24 hours' + (p_escala_saida - p_escala_entrada));
  ELSE
    -- Turno diurno normal
    horas_escala := p_escala_saida - p_escala_entrada;
  END IF;
  
  -- Subtrair intervalo se existe
  IF p_intervalo_inicio IS NOT NULL AND p_intervalo_fim IS NOT NULL THEN
    IF p_intervalo_fim < p_intervalo_inicio THEN
      -- Intervalo cruza meia-noite
      intervalo_escala := (INTERVAL '24 hours' + (p_intervalo_fim - p_intervalo_inicio));
    ELSE
      intervalo_escala := p_intervalo_fim - p_intervalo_inicio;
    END IF;
    horas_escala := horas_escala - intervalo_escala;
  END IF;
  
  -- Calcular extras diurnas (horas trabalhadas além da escala, excluindo noturnas)
  IF horas_trabalhadas > horas_escala THEN
    horas_extras := horas_trabalhadas - horas_escala;
    
    -- Calcular horas noturnas trabalhadas
    horas_noturnas := calcular_horas_noturnas(p_entrada, p_saida, p_intervalo_inicio, p_intervalo_fim);
    
    -- Calcular horas noturnas da escala para comparação
    horas_noturnas_escala := calcular_horas_noturnas(p_escala_entrada, p_escala_saida, p_intervalo_inicio, p_intervalo_fim);
    
    -- Horas extras noturnas = horas noturnas trabalhadas além do previsto na escala
    IF horas_noturnas > horas_noturnas_escala THEN
      -- Subtrair apenas as horas extras noturnas das extras totais
      horas_extras := horas_extras - (horas_noturnas - horas_noturnas_escala);
    END IF;
  END IF;
  
  -- Garantir que não seja negativo
  IF horas_extras < INTERVAL '0 hours' THEN
    horas_extras := INTERVAL '0 hours';
  END IF;
  
  RETURN horas_extras;
END;
$$;

-- Corrigir a função calcular_horas_extras_noturnas para considerar escala
DROP FUNCTION IF EXISTS public.calcular_horas_extras_noturnas(TIME, TIME, TIME, TIME);

CREATE OR REPLACE FUNCTION public.calcular_horas_extras_noturnas(
  p_entrada TIME,
  p_intervalo_inicio TIME,
  p_intervalo_fim TIME,
  p_saida TIME,
  p_escala_entrada TIME DEFAULT NULL,
  p_escala_saida TIME DEFAULT NULL
)
RETURNS INTERVAL
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  horas_noturnas_trabalhadas INTERVAL;
  horas_noturnas_escala INTERVAL := INTERVAL '0 hours';
  horas_extras_noturnas INTERVAL := INTERVAL '0 hours';
BEGIN
  -- Se não há entrada ou saída, retorna 0
  IF p_entrada IS NULL OR p_saida IS NULL THEN
    RETURN INTERVAL '0 hours';
  END IF;
  
  -- Calcular horas noturnas trabalhadas
  horas_noturnas_trabalhadas := calcular_horas_noturnas(p_entrada, p_saida, p_intervalo_inicio, p_intervalo_fim);
  
  -- Se temos informações da escala, calcular horas noturnas da escala
  IF p_escala_entrada IS NOT NULL AND p_escala_saida IS NOT NULL THEN
    horas_noturnas_escala := calcular_horas_noturnas(p_escala_entrada, p_escala_saida, p_intervalo_inicio, p_intervalo_fim);
  END IF;
  
  -- Horas extras noturnas = trabalhadas além do previsto na escala
  IF horas_noturnas_trabalhadas > horas_noturnas_escala THEN
    horas_extras_noturnas := horas_noturnas_trabalhadas - horas_noturnas_escala;
  END IF;
  
  RETURN horas_extras_noturnas;
END;
$$;

-- Recriar a função gerar_folha_ponto_mensal
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(
  p_funcionario_id UUID,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE(
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
  horas_trabalhadas TEXT,
  horas_extras_diurnas TEXT,
  horas_extras_noturnas TEXT,
  faltas BOOLEAN,
  abonos BOOLEAN,
  observacoes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    dias_no_mes INTEGER;
    dia_atual INTEGER;
    data_atual DATE;
    funcionario_record RECORD;
    registro_record RECORD;
    calc_horas_trabalhadas text;
    calc_horas_extras_diurnas text;
    calc_horas_extras_noturnas text;
    calc_faltas boolean;
    calc_abonos boolean;
BEGIN
    -- Buscar informações do funcionário
    SELECT 
        f.nome_completo,
        f.cpf,
        f.funcao,
        e.nome as escala_nome,
        e.entrada as escala_entrada,
        e.saida as escala_saida,
        e.intervalo_inicio as escala_intervalo_inicio,
        e.intervalo_fim as escala_intervalo_fim
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
        
        -- Inicializar variáveis
        calc_horas_trabalhadas := '00:00:00';
        calc_horas_extras_diurnas := '00:00:00';
        calc_horas_extras_noturnas := '00:00:00';
        calc_faltas := false;
        calc_abonos := false;
        
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
        IF registro_record.observacoes ILIKE '%abono%' THEN
            calc_abonos := true;
        ELSIF registro_record.observacoes ILIKE '%falta%' THEN
            calc_faltas := true;
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
            
            -- Calcular horas extras noturnas (agora passando a escala)
            BEGIN
                SELECT COALESCE(calcular_horas_extras_noturnas(
                    registro_record.entrada, 
                    registro_record.intervalo_inicio, 
                    registro_record.intervalo_fim, 
                    registro_record.saida,
                    funcionario_record.escala_entrada,
                    funcionario_record.escala_saida
                )::text, '00:00:00')
                INTO calc_horas_extras_noturnas;
            EXCEPTION 
                WHEN OTHERS THEN 
                    calc_horas_extras_noturnas := '00:00:00';
            END;
        END IF;

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
$$;
