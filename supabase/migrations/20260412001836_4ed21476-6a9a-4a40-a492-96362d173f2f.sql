CREATE OR REPLACE FUNCTION public.gamificacao_on_registro_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_streak INT;
  v_streak_bonus INT;
  v_xp INT;
  v_moedas INT;
BEGIN
  -- Only process on INSERT (new entry record for the day)
  -- No need to check tipo since the trigger fires on INSERT only

  -- Ensure profile exists
  INSERT INTO gamification_profiles (funcionario_id)
  VALUES (NEW.funcionario_id)
  ON CONFLICT (funcionario_id) DO NOTHING;

  -- Get current profile
  SELECT * INTO v_profile FROM gamification_profiles WHERE funcionario_id = NEW.funcionario_id;

  -- Calculate streak bonus (max +20)
  v_streak := COALESCE(v_profile.streak_plantoes, 0);
  v_streak_bonus := LEAST(v_streak, 20);

  -- Base XP + streak bonus
  v_xp := 10 + v_streak_bonus;
  v_moedas := 10 + v_streak_bonus;

  -- Record transaction for shift
  INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao, referencia_id)
  VALUES (NEW.funcionario_id, 'plantao', v_xp, v_moedas, 
          'Plantão registrado (streak: ' || (v_streak + 1) || ', bônus: +' || v_streak_bonus || ')',
          NEW.id);

  -- Record micro-task for correct clock-in
  INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao, referencia_id)
  VALUES (NEW.funcionario_id, 'micro_tarefa_ponto', 2, 2, 'Ponto eletrônico registrado corretamente', NEW.id);

  -- Update profile
  UPDATE gamification_profiles SET
    xp_total = GREATEST(0, xp_total + v_xp + 2),
    moedas = GREATEST(0, moedas + v_moedas + 2),
    streak_plantoes = v_streak + 1,
    ultimo_plantao_data = CURRENT_DATE
  WHERE funcionario_id = NEW.funcionario_id;

  RETURN NEW;
END;
$$;