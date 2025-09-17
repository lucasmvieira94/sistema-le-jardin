-- Corrigir função de inicialização de prontuário para garantir persistência de status
CREATE OR REPLACE FUNCTION public.iniciar_prontuario_diario(p_residente_id uuid, p_funcionario_id uuid)
RETURNS TABLE(success boolean, message text, ciclo_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ciclo_id_var UUID;
  data_brasil DATE;
  horario_brasil TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obter data no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  horario_brasil := NOW() AT TIME ZONE 'America/Sao_Paulo';
  
  -- Verificar se já existe ciclo para hoje
  SELECT id INTO ciclo_id_var
  FROM public.prontuario_ciclos
  WHERE data_ciclo = data_brasil 
  AND residente_id = p_residente_id;
  
  -- Se não existe, criar novo ciclo
  IF ciclo_id_var IS NULL THEN
    INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status, data_inicio_efetivo)
    VALUES (data_brasil, p_residente_id, 'em_andamento', horario_brasil)
    RETURNING id INTO ciclo_id_var;
    
    RETURN QUERY SELECT true, 'Novo prontuário iniciado com sucesso'::text, ciclo_id_var;
  ELSE
    -- Sempre atualizar para em_andamento quando for iniciado, independente do status atual
    UPDATE public.prontuario_ciclos 
    SET status = 'em_andamento',
        data_inicio_efetivo = COALESCE(data_inicio_efetivo, horario_brasil),
        updated_at = NOW()
    WHERE id = ciclo_id_var;
    
    RETURN QUERY SELECT true, 'Prontuário iniciado com sucesso'::text, ciclo_id_var;
  END IF;
END;
$function$;

-- Corrigir função de redefinição para NÃO interferir com prontuários do dia atual
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_com_horario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  data_ontem DATE;
  data_brasil DATE;
BEGIN
  -- Obter datas no timezone do Brasil
  data_brasil := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  data_ontem := data_brasil - INTERVAL '1 day';
  
  -- APENAS finalizar prontuários do DIA ANTERIOR que não foram finalizados
  -- NÃO ALTERAR prontuários do dia atual
  UPDATE public.prontuario_ciclos 
  SET status = 'encerrado',
      data_encerramento = NOW() AT TIME ZONE 'America/Sao_Paulo',
      updated_at = NOW()
  WHERE data_ciclo < data_brasil -- Apenas dias anteriores
  AND status IN ('em_andamento', 'nao_iniciado');
  
  RAISE NOTICE 'Finalizados apenas prontuários de dias anteriores a: %', data_brasil;
END;
$function$;

-- Criar função para garantir que dados sejam preservados durante salvamento
CREATE OR REPLACE FUNCTION public.preservar_status_prontuario_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o ciclo está sendo atualizado e tem data_inicio_efetivo, garantir que status seja pelo menos 'em_andamento'
  IF NEW.data_inicio_efetivo IS NOT NULL AND NEW.status = 'nao_iniciado' THEN
    NEW.status := 'em_andamento';
  END IF;
  
  -- Garantir que updated_at seja atualizado
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$function$;

-- Aplicar trigger para proteger status dos ciclos ativos
DROP TRIGGER IF EXISTS trigger_preservar_status_prontuario ON public.prontuario_ciclos;
CREATE TRIGGER trigger_preservar_status_prontuario
  BEFORE UPDATE ON public.prontuario_ciclos
  FOR EACH ROW
  EXECUTE FUNCTION public.preservar_status_prontuario_ativo();