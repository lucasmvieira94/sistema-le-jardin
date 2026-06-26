
-- Trigger: ao excluir um afastamento, remover registros_ponto gerados (tipo 'abono' ou 'falta')
-- e gravar evento de auditoria no audit_log.
CREATE OR REPLACE FUNCTION public.remover_registros_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  data_final DATE;
  qtd_removidos INTEGER := 0;
BEGIN
  -- Determinar data final do afastamento
  IF OLD.tipo_periodo = 'dias' THEN
    data_final := OLD.data_inicio + COALESCE(OLD.quantidade_dias, 1) - 1;
  ELSE
    data_final := OLD.data_inicio;
  END IF;

  -- Remover registros_ponto gerados pelo afastamento (abono/falta) no período
  WITH removidos AS (
    DELETE FROM public.registros_ponto
    WHERE funcionario_id = OLD.funcionario_id
      AND data BETWEEN OLD.data_inicio AND data_final
      AND tipo_registro IN ('abono', 'falta')
    RETURNING 1
  )
  SELECT COUNT(*) INTO qtd_removidos FROM removidos;

  -- Auditoria server-side (garante registro mesmo se o frontend falhar)
  INSERT INTO public.audit_log (
    user_id, tabela, operacao, dados_anteriores, dados_novos, tenant_id
  ) VALUES (
    auth.uid(),
    'afastamentos',
    'DELETE_CASCADE',
    to_jsonb(OLD),
    jsonb_build_object(
      'registros_ponto_removidos', qtd_removidos,
      'periodo_inicio', OLD.data_inicio,
      'periodo_fim', data_final
    ),
    OLD.tenant_id
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_remover_registros_afastamento ON public.afastamentos;
CREATE TRIGGER trg_remover_registros_afastamento
BEFORE DELETE ON public.afastamentos
FOR EACH ROW
EXECUTE FUNCTION public.remover_registros_afastamento();
