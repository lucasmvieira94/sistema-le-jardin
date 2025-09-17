-- Corrigir e melhorar a função de criação de ciclos diários
CREATE OR REPLACE FUNCTION public.criar_ciclo_prontuario_diario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  residente_record RECORD;
  ciclo_id UUID;
  data_brasil DATE;
  total_residentes INTEGER := 0;
  ciclos_criados INTEGER := 0;
BEGIN
  -- Obter data no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  RAISE NOTICE 'Iniciando criação de ciclos para data: %', data_brasil;
  
  -- Para cada residente ativo
  FOR residente_record IN 
    SELECT id, nome_completo FROM public.residentes WHERE ativo = true
  LOOP
    total_residentes := total_residentes + 1;
    
    -- Verificar se já existe ciclo para hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.prontuario_ciclos 
      WHERE data_ciclo = data_brasil 
      AND residente_id = residente_record.id
    ) THEN
      -- Criar novo ciclo para hoje
      INSERT INTO public.prontuario_ciclos (
        data_ciclo, 
        residente_id, 
        status,
        created_at,
        updated_at
      )
      VALUES (
        data_brasil, 
        residente_record.id, 
        'nao_iniciado',
        NOW(),
        NOW()
      );
      
      ciclos_criados := ciclos_criados + 1;
      RAISE NOTICE 'Ciclo criado para residente: % (ID: %)', residente_record.nome_completo, residente_record.id;
    ELSE
      RAISE NOTICE 'Ciclo já existe para residente: % (ID: %)', residente_record.nome_completo, residente_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Processo concluído: % residentes ativos, % ciclos criados', total_residentes, ciclos_criados;
END;
$function$;