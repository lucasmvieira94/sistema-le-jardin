-- Criar função para calcular horas extras diurnas
CREATE OR REPLACE FUNCTION public.calcular_horas_extras_diurnas(
  p_entrada time without time zone, 
  p_intervalo_inicio time without time zone, 
  p_intervalo_fim time without time zone, 
  p_saida time without time zone,
  p_escala_entrada time without time zone,
  p_escala_saida time without time zone
)
RETURNS interval
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  horas_trabalhadas INTERVAL;
  horas_escala INTERVAL;
  horas_extras INTERVAL := INTERVAL '0 hours';
BEGIN
  -- Se não há entrada ou saída, retorna 0
  IF p_entrada IS NULL OR p_saida IS NULL OR p_escala_entrada IS NULL OR p_escala_saida IS NULL THEN
    RETURN INTERVAL '0 hours';
  END IF;
  
  -- Calcular horas trabalhadas
  horas_trabalhadas := calcular_horas_trabalhadas(p_entrada, p_saida, p_intervalo_inicio, p_intervalo_fim);
  
  -- Calcular horas da escala
  horas_escala := p_escala_saida - p_escala_entrada;
  
  -- Se há intervalo na escala, subtrair
  IF p_intervalo_inicio IS NOT NULL AND p_intervalo_fim IS NOT NULL THEN
    horas_escala := horas_escala - (p_intervalo_fim - p_intervalo_inicio);
  END IF;
  
  -- Calcular extras (apenas diurnas - fora do período noturno 22h-5h)
  IF horas_trabalhadas > horas_escala THEN
    horas_extras := horas_trabalhadas - horas_escala;
    
    -- Subtrair horas noturnas das extras
    horas_extras := horas_extras - calcular_horas_noturnas(p_entrada, p_saida, p_intervalo_inicio, p_intervalo_fim);
  END IF;
  
  -- Garantir que não seja negativo
  IF horas_extras < INTERVAL '0 hours' THEN
    horas_extras := INTERVAL '0 hours';
  END IF;
  
  RETURN horas_extras;
END;
$function$;

-- Criar função para calcular horas extras noturnas
CREATE OR REPLACE FUNCTION public.calcular_horas_extras_noturnas(
  p_entrada time without time zone, 
  p_intervalo_inicio time without time zone, 
  p_intervalo_fim time without time zone, 
  p_saida time without time zone
)
RETURNS interval
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Por enquanto, consideramos que todas as horas noturnas são extras
  -- (pode ser ajustado conforme regras específicas da empresa)
  horas_extras_noturnas := horas_noturnas_trabalhadas;
  
  RETURN horas_extras_noturnas;
END;
$function$;