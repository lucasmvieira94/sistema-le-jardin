CREATE OR REPLACE FUNCTION public.gamificacao_on_advertencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INT := 0;
  v_moedas INT := 0;
  v_tipo public.gamification_transaction_tipo;
  v_desc TEXT;
  v_reset_streak BOOLEAN := false;
  v_tenant_id UUID;
BEGIN
  SELECT f.tenant_id INTO v_tenant_id
  FROM public.funcionarios f
  WHERE f.id = NEW.funcionario_id;

  INSERT INTO public.gamification_profiles (funcionario_id, tenant_id)
  VALUES (NEW.funcionario_id, COALESCE(NEW.tenant_id, v_tenant_id))
  ON CONFLICT (funcionario_id) DO NOTHING;

  CASE NEW.tipo
    WHEN 'advertencia_verbal' THEN
      v_xp := -50;
      v_moedas := -50;
      v_tipo := 'advertencia_verbal'::public.gamification_transaction_tipo;
      v_desc := 'Advertência verbal aplicada';
    WHEN 'advertencia_escrita' THEN
      v_xp := -150;
      v_moedas := -150;
      v_tipo := 'advertencia_escrita'::public.gamification_transaction_tipo;
      v_desc := 'Advertência escrita aplicada';
    WHEN 'suspensao' THEN
      v_xp := -500 * COALESCE(NEW.dias_suspensao, 1);
      v_moedas := -500 * COALESCE(NEW.dias_suspensao, 1);
      v_tipo := 'suspensao'::public.gamification_transaction_tipo;
      v_desc := 'Suspensão de ' || COALESCE(NEW.dias_suspensao, 1) || ' dia(s)';
      v_reset_streak := true;
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.gamification_transactions (
    funcionario_id,
    tipo,
    xp_delta,
    moedas_delta,
    descricao,
    referencia_id,
    tenant_id
  )
  VALUES (
    NEW.funcionario_id,
    v_tipo,
    v_xp,
    v_moedas,
    v_desc,
    NEW.id,
    COALESCE(NEW.tenant_id, v_tenant_id)
  );

  UPDATE public.gamification_profiles
  SET
    xp_total = GREATEST(0, xp_total + v_xp),
    moedas = GREATEST(0, moedas + v_moedas),
    streak_plantoes = CASE WHEN v_reset_streak THEN 0 ELSE streak_plantoes END,
    tenant_id = COALESCE(gamification_profiles.tenant_id, NEW.tenant_id, v_tenant_id),
    updated_at = now()
  WHERE funcionario_id = NEW.funcionario_id;

  RETURN NEW;
END;
$$;