-- Corrigir search_path na função log_audit_event que ainda não foi atualizada

-- Atualizar função log_audit_event com search_path seguro
CREATE OR REPLACE FUNCTION public.log_audit_event(p_tabela text, p_operacao text, p_dados_anteriores jsonb DEFAULT NULL::jsonb, p_dados_novos jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    tabela,
    operacao,
    dados_anteriores,
    dados_novos
  ) VALUES (
    auth.uid(),
    p_tabela,
    p_operacao,
    p_dados_anteriores,
    p_dados_novos
  );
END;
$$;