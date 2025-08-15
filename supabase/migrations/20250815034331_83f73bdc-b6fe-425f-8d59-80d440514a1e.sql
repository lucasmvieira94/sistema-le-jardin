-- Corrigir função para processar abonos com horários da escala
CREATE OR REPLACE FUNCTION public.processar_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  data_atual DATE;
  tipo_registro_valor VARCHAR(50);
  eh_remunerado BOOLEAN;
  escala_info RECORD;
  observacao_completa TEXT;
BEGIN
  -- Determinar o tipo de registro e se é remunerado
  SELECT 
    CASE 
      WHEN ta.remunerado = true THEN 'abono'
      ELSE 'falta'
    END,
    ta.remunerado,
    ta.descricao
  INTO tipo_registro_valor, eh_remunerado, observacao_completa
  FROM public.tipos_afastamento ta 
  WHERE ta.id = NEW.tipo_afastamento_id;

  -- Preparar observação completa
  observacao_completa := 'Abono: ' || observacao_completa || 
    CASE 
      WHEN NEW.observacoes IS NOT NULL AND NEW.observacoes != '' 
      THEN ' - ' || NEW.observacoes
      ELSE ''
    END;

  -- Se é afastamento por dias
  IF NEW.tipo_periodo = 'dias' THEN
    FOR i IN 0..(NEW.quantidade_dias - 1) LOOP
      data_atual := NEW.data_inicio + i;
      
      -- Se é abono (remunerado), inserir com horários da escala
      IF eh_remunerado = true THEN
        -- Buscar horários da escala para o dia
        SELECT 
          entrada, intervalo_inicio, intervalo_fim, saida, deve_trabalhar
        INTO escala_info
        FROM public.preencher_horarios_por_escala(NEW.funcionario_id, data_atual, data_atual)
        WHERE data = data_atual;
        
        -- Se deve trabalhar neste dia, inserir com horários da escala
        IF escala_info.deve_trabalhar = true THEN
          INSERT INTO public.registros_ponto 
            (funcionario_id, data, entrada, intervalo_inicio, intervalo_fim, saida, tipo_registro, observacoes)
          VALUES 
            (NEW.funcionario_id, data_atual, escala_info.entrada, escala_info.intervalo_inicio, 
             escala_info.intervalo_fim, escala_info.saida, tipo_registro_valor, observacao_completa)
          ON CONFLICT (funcionario_id, data) 
          DO UPDATE SET 
            entrada = escala_info.entrada,
            intervalo_inicio = escala_info.intervalo_inicio,
            intervalo_fim = escala_info.intervalo_fim,
            saida = escala_info.saida,
            tipo_registro = tipo_registro_valor,
            observacoes = observacao_completa,
            updated_at = now();
        ELSE
          -- Se não deve trabalhar, inserir só a observação
          INSERT INTO public.registros_ponto 
            (funcionario_id, data, tipo_registro, observacoes)
          VALUES 
            (NEW.funcionario_id, data_atual, tipo_registro_valor, observacao_completa)
          ON CONFLICT (funcionario_id, data) 
          DO UPDATE SET 
            tipo_registro = tipo_registro_valor,
            observacoes = observacao_completa,
            updated_at = now();
        END IF;
      ELSE
        -- Se é falta, inserir sem horários
        INSERT INTO public.registros_ponto 
          (funcionario_id, data, tipo_registro, observacoes)
        VALUES 
          (NEW.funcionario_id, data_atual, tipo_registro_valor, NEW.observacoes)
        ON CONFLICT (funcionario_id, data) 
        DO UPDATE SET 
          tipo_registro = tipo_registro_valor,
          observacoes = COALESCE(NEW.observacoes, ''),
          updated_at = now();
      END IF;
    END LOOP;
  
  -- Se é afastamento por horas
  ELSIF NEW.tipo_periodo = 'horas' THEN
    IF eh_remunerado = true THEN
      -- Para abono por horas, inserir com horários da escala
      SELECT 
        entrada, intervalo_inicio, intervalo_fim, saida, deve_trabalhar
      INTO escala_info
      FROM public.preencher_horarios_por_escala(NEW.funcionario_id, NEW.data_inicio, NEW.data_inicio)
      WHERE data = NEW.data_inicio;
      
      IF escala_info.deve_trabalhar = true THEN
        INSERT INTO public.registros_ponto 
          (funcionario_id, data, entrada, intervalo_inicio, intervalo_fim, saida, tipo_registro, observacoes)
        VALUES 
          (NEW.funcionario_id, NEW.data_inicio, escala_info.entrada, escala_info.intervalo_inicio,
           escala_info.intervalo_fim, escala_info.saida, tipo_registro_valor, 
           observacao_completa || ' (' || NEW.quantidade_horas || 'h)')
        ON CONFLICT (funcionario_id, data) 
        DO UPDATE SET 
          entrada = escala_info.entrada,
          intervalo_inicio = escala_info.intervalo_inicio,
          intervalo_fim = escala_info.intervalo_fim,
          saida = escala_info.saida,
          tipo_registro = tipo_registro_valor,
          observacoes = observacao_completa || ' (' || NEW.quantidade_horas || 'h)',
          updated_at = now();
      END IF;
    ELSE
      -- Para falta por horas, inserir sem horários
      INSERT INTO public.registros_ponto 
        (funcionario_id, data, tipo_registro, observacoes)
      VALUES 
        (NEW.funcionario_id, NEW.data_inicio, tipo_registro_valor, 
         COALESCE(NEW.observacoes, '') || ' (' || NEW.quantidade_horas || 'h)')
      ON CONFLICT (funcionario_id, data) 
      DO UPDATE SET 
        tipo_registro = tipo_registro_valor,
        observacoes = COALESCE(NEW.observacoes, '') || ' (' || NEW.quantidade_horas || 'h)',
        updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;