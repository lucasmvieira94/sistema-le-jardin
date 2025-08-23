-- Remover funções duplicadas e corrigir a função de verificação de prontuário
DROP FUNCTION IF EXISTS public.verificar_prontuario_diario_existente(uuid, date);
DROP FUNCTION IF EXISTS public.verificar_prontuario_diario_existente(uuid);

-- Recrear a função com a assinatura correta
CREATE OR REPLACE FUNCTION public.verificar_prontuario_diario_existente(p_residente_id uuid, p_data date DEFAULT CURRENT_DATE)
 RETURNS TABLE(ja_iniciado boolean, ciclo_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN pc.id IS NOT NULL THEN true ELSE false END as ja_iniciado,
    pc.id as ciclo_id,
    COALESCE(pc.status, 'nao_iniciado') as status
  FROM prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id 
    AND pc.data_ciclo = p_data
  ORDER BY pc.created_at DESC
  LIMIT 1;
  
  -- Se não encontrou nenhum registro, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'nao_iniciado'::TEXT;
  END IF;
END;
$function$;

-- Corrigir a função de iniciar prontuário para usar a assinatura correta
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
  
  -- Se já existe, retornar o ciclo existente
  IF existing_ciclo_id IS NOT NULL THEN
    RETURN QUERY SELECT existing_ciclo_id, true, 
      CASE 
        WHEN existing_status = 'em_andamento' THEN 'Prontuário já iniciado hoje, continuando...'
        WHEN existing_status = 'encerrado' THEN 'Prontuário já foi finalizado hoje'
        WHEN existing_status = 'nao_iniciado' THEN 'Prontuário encontrado, iniciando...'
        ELSE 'Prontuário encontrado com status: ' || existing_status
      END;
    
    -- Se o status for 'nao_iniciado', atualizar para 'em_andamento'
    IF existing_status = 'nao_iniciado' THEN
      UPDATE public.prontuario_ciclos 
      SET status = 'em_andamento', updated_at = now()
      WHERE id = existing_ciclo_id;
    END IF;
    
    RETURN;
  END IF;
  
  -- Criar novo ciclo se não existir
  INSERT INTO public.prontuario_ciclos (
    data_ciclo, 
    residente_id, 
    status
  )
  VALUES (
    CURRENT_DATE, 
    p_residente_id, 
    'em_andamento'
  )
  RETURNING id INTO new_ciclo_id;
  
  RETURN QUERY SELECT new_ciclo_id, true, 'Prontuário iniciado com sucesso';
END;
$function$;