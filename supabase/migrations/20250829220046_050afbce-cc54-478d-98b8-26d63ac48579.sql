-- Corrigir a função iniciar_prontuario_diario para garantir que o status seja atualizado corretamente
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(p_residente_id uuid, p_funcionario_id uuid)
 RETURNS TABLE(ciclo_id uuid, success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_ciclo_id uuid;
  existing_status character varying;
  new_ciclo_id uuid;
BEGIN
  -- Verificar se já existe prontuário para hoje
  SELECT vp.ciclo_id, vp.status 
  INTO existing_ciclo_id, existing_status
  FROM public.verificar_prontuario_diario_existente(p_residente_id, CURRENT_DATE) vp
  WHERE vp.ja_iniciado = true;
  
  -- Se já existe, retornar o ciclo existente e atualizar status se necessário
  IF existing_ciclo_id IS NOT NULL THEN
    -- Se o status for 'nao_iniciado', atualizar para 'em_andamento'
    IF existing_status = 'nao_iniciado' THEN
      UPDATE public.prontuario_ciclos 
      SET status = 'em_andamento', 
          data_inicio_efetivo = now(),
          updated_at = now()
      WHERE id = existing_ciclo_id;
      
      RETURN QUERY SELECT existing_ciclo_id, true, 'Prontuário iniciado com sucesso';
    ELSE
      RETURN QUERY SELECT existing_ciclo_id, true, 
        CASE 
          WHEN existing_status = 'em_andamento' THEN 'Prontuário já iniciado, continuando...'
          WHEN existing_status = 'encerrado' THEN 'Prontuário já foi finalizado hoje'
          ELSE 'Prontuário encontrado com status: ' || existing_status
        END;
    END IF;
    
    RETURN;
  END IF;
  
  -- Criar novo ciclo se não existir
  INSERT INTO public.prontuario_ciclos (
    data_ciclo, 
    residente_id, 
    status,
    data_inicio_efetivo
  )
  VALUES (
    CURRENT_DATE, 
    p_residente_id, 
    'em_andamento',
    now()
  )
  RETURNING id INTO new_ciclo_id;
  
  RETURN QUERY SELECT new_ciclo_id, true, 'Prontuário criado e iniciado com sucesso';
END;
$function$;