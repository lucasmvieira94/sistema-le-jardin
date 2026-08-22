-- 1) Trigger: só preenche intervalo automaticamente se a escala for pré-assinalada
CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  escala_intervalo_minutos INTEGER;
  escala_pre_assinalado BOOLEAN;
  padrao_empresa INTEGER;
  minutos_intervalo INTEGER;
  jornada_duracao INTERVAL;
  hora_inicio_intervalo TIME;
  hora_fim_intervalo TIME;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.saida IS NULL AND NEW.saida IS NOT NULL THEN
    IF NEW.intervalo_inicio IS NULL AND NEW.intervalo_fim IS NULL THEN
      SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim, e.intervalo_minutos,
             COALESCE(e.intervalo_pre_assinalado, false)
      INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim,
           escala_intervalo_minutos, escala_pre_assinalado
      FROM public.funcionarios f
      JOIN public.escalas e ON f.escala_id = e.id
      WHERE f.id = NEW.funcionario_id;

      -- Escalas sem intervalo pré-assinalado NÃO recebem preenchimento automático
      IF NOT COALESCE(escala_pre_assinalado, false) THEN
        RETURN NEW;
      END IF;

      IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
        NEW.intervalo_inicio := escala_intervalo_inicio;
        NEW.intervalo_fim := escala_intervalo_fim;
      ELSE
        SELECT c.intervalo_minimo_minutos INTO padrao_empresa
        FROM public.configuracoes_empresa c
        LIMIT 1;

        minutos_intervalo := COALESCE(NULLIF(escala_intervalo_minutos, 0), padrao_empresa, 60);

        IF escala_entrada IS NOT NULL AND escala_saida IS NOT NULL AND NEW.entrada IS NOT NULL THEN
          jornada_duracao := escala_saida - escala_entrada;

          IF jornada_duracao > INTERVAL '6 hours' THEN
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2
              - make_interval(mins => minutos_intervalo / 2);
            hora_fim_intervalo := hora_inicio_intervalo + make_interval(mins => minutos_intervalo);
          ELSIF jornada_duracao > INTERVAL '4 hours' THEN
            hora_inicio_intervalo := NEW.entrada + (NEW.saida - NEW.entrada) / 2 - INTERVAL '7.5 minutes';
            hora_fim_intervalo := hora_inicio_intervalo + INTERVAL '15 minutes';
          END IF;

          IF hora_inicio_intervalo IS NOT NULL AND hora_fim_intervalo IS NOT NULL THEN
            NEW.intervalo_inicio := hora_inicio_intervalo;
            NEW.intervalo_fim := hora_fim_intervalo;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Função auxiliar: retorna NULL quando a escala não é pré-assinalada
CREATE OR REPLACE FUNCTION public.inserir_intervalo_automatico(p_funcionario_id uuid, p_data date, p_entrada time without time zone, p_saida time without time zone)
 RETURNS TABLE(intervalo_inicio time without time zone, intervalo_fim time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  escala_pre_assinalado BOOLEAN;
  duracao_jornada INTERVAL;
  meio_jornada_dt TIMESTAMP;
  inicio_intervalo_dt TIMESTAMP;
  fim_intervalo_dt TIMESTAMP;
  entrada_dt TIMESTAMP;
  saida_dt TIMESTAMP;
BEGIN
  SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim,
         COALESCE(e.intervalo_pre_assinalado, false)
  INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim, escala_pre_assinalado
  FROM public.funcionarios f
  JOIN public.escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;

  IF NOT COALESCE(escala_pre_assinalado, false) THEN
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
    RETURN;
  END IF;

  IF escala_intervalo_inicio IS NOT NULL AND escala_intervalo_fim IS NOT NULL THEN
    RETURN QUERY SELECT escala_intervalo_inicio, escala_intervalo_fim;
    RETURN;
  END IF;

  entrada_dt := '2000-01-01'::DATE + p_entrada;
  saida_dt := '2000-01-01'::DATE + p_saida;

  IF p_saida < p_entrada THEN
    saida_dt := saida_dt + INTERVAL '1 day';
  END IF;

  duracao_jornada := saida_dt - entrada_dt;

  IF duracao_jornada > INTERVAL '6 hours' THEN
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '30 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '30 minutes';
  ELSIF duracao_jornada > INTERVAL '4 hours' THEN
    meio_jornada_dt := entrada_dt + (duracao_jornada / 2);
    inicio_intervalo_dt := meio_jornada_dt - INTERVAL '7.5 minutes';
    fim_intervalo_dt := meio_jornada_dt + INTERVAL '7.5 minutes';
  ELSE
    RETURN QUERY SELECT NULL::TIME, NULL::TIME;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    inicio_intervalo_dt::TIME,
    fim_intervalo_dt::TIME;
END;
$function$;