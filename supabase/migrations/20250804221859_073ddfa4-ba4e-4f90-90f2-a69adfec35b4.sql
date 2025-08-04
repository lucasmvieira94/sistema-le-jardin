-- Função para determinar a data de referência do registro (sempre o dia da entrada)
CREATE OR REPLACE FUNCTION public.obter_data_referencia_registro(
  p_data_entrada DATE,
  p_hora_entrada TIME,
  p_hora_saida TIME
) RETURNS DATE
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Se não há hora de entrada, usa a data fornecida
  IF p_hora_entrada IS NULL THEN
    RETURN p_data_entrada;
  END IF;
  
  -- Se não há hora de saída, usa a data fornecida
  IF p_hora_saida IS NULL THEN
    RETURN p_data_entrada;
  END IF;
  
  -- Se a saída é menor que a entrada, é um turno noturno
  -- O registro deve aparecer no dia da entrada
  IF p_hora_saida < p_hora_entrada THEN
    RETURN p_data_entrada;
  END IF;
  
  -- Caso normal, mesmo dia
  RETURN p_data_entrada;
END;
$$;

-- Função para calcular horas trabalhadas considerando turnos noturnos
CREATE OR REPLACE FUNCTION public.calcular_horas_trabalhadas_turno_noturno(
  p_entrada TIME,
  p_saida TIME,
  p_intervalo_inicio TIME DEFAULT NULL,
  p_intervalo_fim TIME DEFAULT NULL
) RETURNS INTERVAL
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  horas_totais INTERVAL;
  intervalo_duracao INTERVAL;
  entrada_dt TIMESTAMP;
  saida_dt TIMESTAMP;
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
  
  -- Calcula total de horas
  horas_totais := saida_dt - entrada_dt;
  
  -- Se há intervalo, subtrai do total
  IF p_intervalo_inicio IS NOT NULL AND p_intervalo_fim IS NOT NULL THEN
    -- Tratar intervalo que pode cruzar meia-noite também
    IF p_intervalo_fim < p_intervalo_inicio THEN
      intervalo_duracao := ('2000-01-02'::DATE + p_intervalo_fim) - ('2000-01-01'::DATE + p_intervalo_inicio);
    ELSE
      intervalo_duracao := p_intervalo_fim - p_intervalo_inicio;
    END IF;
    horas_totais := horas_totais - intervalo_duracao;
  END IF;
  
  RETURN horas_totais;
END;
$$;

-- Função para inserir intervalo automático baseado na escala
CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(
  p_funcionario_id UUID,
  p_data DATE,
  p_entrada TIME,
  p_saida TIME
) RETURNS TABLE(intervalo_inicio TIME, intervalo_fim TIME)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  duracao_jornada INTERVAL;
  meio_jornada_dt TIMESTAMP;
  inicio_intervalo_dt TIMESTAMP;
  fim_intervalo_dt TIMESTAMP;
  entrada_dt TIMESTAMP;
  saida_dt TIMESTAMP;
BEGIN
  -- Buscar dados da escala do funcionário
  SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim
  INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;
  
  -- Se a escala tem intervalo definido, usar esse intervalo
  IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
    RETURN QUERY SELECT escala_intervalo_inicio, escala_intervalo_fim;
    RETURN;
  END IF;
  
  -- Criar timestamps para calcular duração
  entrada_dt := '2000-01-01'::DATE + p_entrada;
  saida_dt := '2000-01-01'::DATE + p_saida;
  
  -- Se é turno noturno, ajustar saída para o dia seguinte
  IF p_saida < p_entrada THEN
    saida_dt := saida_dt + INTERVAL '1 day';
  END IF;
  
  duracao_jornada := saida_dt - entrada_dt;
  
  -- Aplicar regras de intervalo baseadas na CLT
  IF duracao_jornada > INTERVAL '6 hours' THEN
    -- Jornada acima de 6h: intervalo de 1 hora no meio
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '30 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '30 minutes';
  ELSIF duracao_jornada > INTERVAL '4 hours' THEN
    -- Jornada entre 4-6h: intervalo de 15 minutos no meio
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '7.5 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '7.5 minutes';
  ELSE
    -- Jornada até 4h: sem intervalo obrigatório
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
    RETURN;
  END IF;
  
  -- Extrair apenas o horário dos timestamps calculados
  RETURN QUERY SELECT 
    inicio_intervalo_dt::TIME as intervalo_inicio,
    fim_intervalo_dt::TIME as intervalo_fim;
END;
$$;