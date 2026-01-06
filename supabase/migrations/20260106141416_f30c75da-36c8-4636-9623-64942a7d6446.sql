-- Atualizar função calcular_horas_trabalhadas para tratar turnos noturnos
CREATE OR REPLACE FUNCTION public.calcular_horas_trabalhadas(
  p_entrada TIME,
  p_saida TIME,
  p_intervalo_inicio TIME DEFAULT NULL,
  p_intervalo_fim TIME DEFAULT NULL
)
RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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