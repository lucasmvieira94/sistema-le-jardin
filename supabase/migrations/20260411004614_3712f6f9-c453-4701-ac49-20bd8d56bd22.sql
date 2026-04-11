-- Add 'congelamento' to the transaction tipo enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'congelamento' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'gamification_transaction_tipo')
  ) THEN
    ALTER TYPE public.gamification_transaction_tipo ADD VALUE 'congelamento';
  END IF;
END$$;

-- Function: auto-process gamification on ponto registration
CREATE OR REPLACE FUNCTION public.gamificacao_on_registro_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_streak INT;
  v_streak_bonus INT;
  v_xp INT;
  v_moedas INT;
BEGIN
  -- Only process entry records (first registro of the day)
  IF NEW.tipo IS NOT NULL AND NEW.tipo != 'entrada' THEN
    RETURN NEW;
  END IF;

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

-- Function: auto-process penalties on advertencias/suspensoes
CREATE OR REPLACE FUNCTION public.gamificacao_on_advertencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INT := 0;
  v_moedas INT := 0;
  v_tipo TEXT;
  v_desc TEXT;
  v_reset_streak BOOLEAN := false;
BEGIN
  -- Ensure profile exists
  INSERT INTO gamification_profiles (funcionario_id)
  VALUES (NEW.funcionario_id)
  ON CONFLICT (funcionario_id) DO NOTHING;

  -- Determine penalty based on type
  CASE NEW.tipo
    WHEN 'verbal' THEN
      v_xp := -50; v_moedas := -50;
      v_tipo := 'advertencia_verbal';
      v_desc := 'Advertência verbal aplicada';
    WHEN 'escrita' THEN
      v_xp := -150; v_moedas := -150;
      v_tipo := 'advertencia_escrita';
      v_desc := 'Advertência escrita aplicada';
    WHEN 'suspensao' THEN
      v_xp := -500 * COALESCE(NEW.dias_suspensao, 1);
      v_moedas := -500 * COALESCE(NEW.dias_suspensao, 1);
      v_tipo := 'suspensao';
      v_desc := 'Suspensão de ' || COALESCE(NEW.dias_suspensao, 1) || ' dia(s)';
      v_reset_streak := true;
    ELSE
      RETURN NEW; -- Unknown type, skip
  END CASE;

  -- Record transaction
  INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao, referencia_id)
  VALUES (NEW.funcionario_id, v_tipo, v_xp, v_moedas, v_desc, NEW.id);

  -- Update profile
  UPDATE gamification_profiles SET
    xp_total = GREATEST(0, xp_total + v_xp),
    moedas = GREATEST(0, moedas + v_moedas),
    streak_plantoes = CASE WHEN v_reset_streak THEN 0 ELSE streak_plantoes END
  WHERE funcionario_id = NEW.funcionario_id;

  RETURN NEW;
END;
$$;

-- Function: freeze streak on medical leave
CREATE OR REPLACE FUNCTION public.gamificacao_on_afastamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_nome TEXT;
BEGIN
  -- Only freeze for medical leave (tipo_afastamento_id = 1 for atestado médico typically)
  -- We freeze for any leave type to be safe
  
  -- Ensure profile exists
  INSERT INTO gamification_profiles (funcionario_id)
  VALUES (NEW.funcionario_id)
  ON CONFLICT (funcionario_id) DO NOTHING;

  -- Record informative transaction (no XP/coin change)
  INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao, referencia_id)
  VALUES (NEW.funcionario_id, 'congelamento', 0, 0, 
          'Streak congelado por afastamento (' || NEW.tipo_periodo || ')',
          NEW.id);

  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_gamificacao_registro_ponto ON registros_ponto;
CREATE TRIGGER trg_gamificacao_registro_ponto
  AFTER INSERT ON registros_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.gamificacao_on_registro_ponto();

DROP TRIGGER IF EXISTS trg_gamificacao_advertencia ON advertencias_suspensoes;
CREATE TRIGGER trg_gamificacao_advertencia
  AFTER INSERT ON advertencias_suspensoes
  FOR EACH ROW
  EXECUTE FUNCTION public.gamificacao_on_advertencia();

DROP TRIGGER IF EXISTS trg_gamificacao_afastamento ON afastamentos;
CREATE TRIGGER trg_gamificacao_afastamento
  AFTER INSERT ON afastamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.gamificacao_on_afastamento();
