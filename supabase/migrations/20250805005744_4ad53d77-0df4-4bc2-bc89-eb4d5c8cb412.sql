-- Fix column ambiguity in the functions
CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(p_funcionario_id uuid, p_data date, p_entrada time without time zone, p_saida time without time zone)
 RETURNS TABLE(intervalo_inicio time without time zone, intervalo_fim time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
  -- Buscar dados da escala do funcionário com aliases específicos
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
    inicio_intervalo_dt::TIME,
    fim_intervalo_dt::TIME;
END;
$function$;