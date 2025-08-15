-- Primeiro verificar se a constraint já existe
DO $$ 
BEGIN
    -- Criar constraint única na tabela registros_ponto se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registros_ponto_funcionario_data_unique' 
        AND table_name = 'registros_ponto'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.registros_ponto 
        ADD CONSTRAINT registros_ponto_funcionario_data_unique 
        UNIQUE (funcionario_id, data);
    END IF;
END $$;

-- Atualizar a função processar_afastamento para funcionar corretamente
CREATE OR REPLACE FUNCTION public.processar_afastamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  data_atual DATE;
  tipo_registro_valor VARCHAR(50);
BEGIN
  -- Determinar o tipo de registro baseado no tipo de afastamento
  SELECT 
    CASE 
      WHEN ta.remunerado = true THEN 'falta_abonada'
      ELSE 'falta'
    END
  INTO tipo_registro_valor
  FROM public.tipos_afastamento ta 
  WHERE ta.id = NEW.tipo_afastamento_id;

  -- Se é afastamento por dias, criar um registro para cada dia
  IF NEW.tipo_periodo = 'dias' THEN
    FOR i IN 0..(NEW.quantidade_dias - 1) LOOP
      data_atual := NEW.data_inicio + i;
      
      -- Inserir ou atualizar registro de ponto
      INSERT INTO public.registros_ponto 
        (funcionario_id, data, tipo_registro, observacoes)
      VALUES 
        (NEW.funcionario_id, data_atual, tipo_registro_valor, NEW.observacoes)
      ON CONFLICT (funcionario_id, data) 
      DO UPDATE SET 
        tipo_registro = tipo_registro_valor,
        observacoes = COALESCE(public.registros_ponto.observacoes, '') || ' | ' || COALESCE(NEW.observacoes, ''),
        updated_at = now();
    END LOOP;
  
  -- Se é afastamento por horas, criar registro para o dia específico
  ELSIF NEW.tipo_periodo = 'horas' THEN
    INSERT INTO public.registros_ponto 
      (funcionario_id, data, tipo_registro, observacoes)
    VALUES 
      (NEW.funcionario_id, NEW.data_inicio, tipo_registro_valor, 
       COALESCE(NEW.observacoes, '') || ' (Afastamento: ' || NEW.quantidade_horas || 'h)')
    ON CONFLICT (funcionario_id, data) 
    DO UPDATE SET 
      tipo_registro = tipo_registro_valor,
      observacoes = COALESCE(public.registros_ponto.observacoes, '') || ' | ' || COALESCE(NEW.observacoes, '') || ' (' || NEW.quantidade_horas || 'h)',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;