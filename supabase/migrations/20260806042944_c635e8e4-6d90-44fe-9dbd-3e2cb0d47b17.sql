-- Usa a duração de intervalo própria de cada escala (com fallback no padrão da empresa)
CREATE OR REPLACE FUNCTION public.adicionar_intervalo_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escala_entrada TIME;
  escala_saida TIME;
  escala_intervalo_inicio TIME;
  escala_intervalo_fim TIME;
  escala_intervalo_minutos INTEGER;
  padrao_empresa INTEGER;
  minutos_intervalo INTEGER;
  jornada_duracao INTERVAL;
  hora_inicio_intervalo TIME;
  hora_fim_intervalo TIME;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.saida IS NULL AND NEW.saida IS NOT NULL THEN
    IF NEW.intervalo_inicio IS NULL AND NEW.intervalo_fim IS NULL THEN
      SELECT e.entrada, e.saida, e.intervalo_inicio, e.intervalo_fim, e.intervalo_minutos
      INTO escala_entrada, escala_saida, escala_intervalo_inicio, escala_intervalo_fim, escala_intervalo_minutos
      FROM public.funcionarios f
      JOIN public.escalas e ON f.escala_id = e.id
      WHERE f.id = NEW.funcionario_id;

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
$$;

-- Escalas sem duração definida herdam o padrão da empresa
UPDATE public.escalas e
SET intervalo_minutos = COALESCE(
  (SELECT c.intervalo_minimo_minutos FROM public.configuracoes_empresa c WHERE c.tenant_id = e.tenant_id LIMIT 1),
  60
)
WHERE e.intervalo_minutos IS NULL OR e.intervalo_minutos = 0;