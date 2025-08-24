-- Corrigir warnings de segurança - definir search_path nas novas funções

-- Corrigir função redefinir_prontuarios_automatico
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  data_hoje DATE := CURRENT_DATE;
  hora_atual TIME := CURRENT_TIME;
  data_ontem DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Log da execução
  RAISE NOTICE 'Redefinindo status de prontuários automaticamente para data: % às %', data_hoje, hora_atual;
  
  -- Finalizar automaticamente prontuários do dia anterior que ainda estão 'em_andamento'
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      data_encerramento = now(),
      updated_at = now()
  WHERE data_ciclo < data_hoje 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos (apenas se não existir para hoje)
  INSERT INTO prontuario_ciclos (residente_id, data_ciclo, status, created_at, updated_at)
  SELECT 
    r.id,
    data_hoje,
    'nao_iniciado',
    now(),
    now()
  FROM residentes r
  WHERE r.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM prontuario_ciclos pc 
      WHERE pc.residente_id = r.id 
        AND pc.data_ciclo = data_hoje
    );

  RAISE NOTICE 'Prontuários redefinidos automaticamente com sucesso';
END;
$function$;

-- Corrigir função buscar_proximo_prontuario  
CREATE OR REPLACE FUNCTION public.buscar_proximo_prontuario(p_residente_atual uuid)
RETURNS TABLE(residente_id uuid, nome_completo text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.nome_completo,
    COALESCE(pc.status, 'nao_iniciado') as status
  FROM residentes r
  LEFT JOIN prontuario_ciclos pc ON r.id = pc.residente_id 
    AND pc.data_ciclo = CURRENT_DATE
  WHERE r.ativo = true
    AND r.id != p_residente_atual
    AND (pc.status IS NULL OR pc.status != 'encerrado')
  ORDER BY 
    CASE 
      WHEN pc.status = 'nao_iniciado' THEN 1
      WHEN pc.status = 'em_andamento' THEN 2
      ELSE 3
    END,
    r.nome_completo
  LIMIT 1;
END;
$function$;