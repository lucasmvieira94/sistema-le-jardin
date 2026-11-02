CREATE OR REPLACE FUNCTION public.portal_med_funcionario()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid;
BEGIN
  -- O acesso ao módulo é independente do acesso ao hub de Cuidados.
  -- O passe continua sendo validado no servidor (expiração e revogação).
  v := public.portal_funcionario_atual();
  IF v IS NULL OR NOT ('medicamentos' = ANY(COALESCE(public.modulos_funcionario(v),'{}'))) THEN
    RAISE EXCEPTION 'Acesso não permitido' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.portal_med_funcionario() FROM PUBLIC, anon, authenticated;