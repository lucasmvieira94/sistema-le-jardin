-- Corrigir a função processar_afastamento para registrar abonos corretamente
CREATE OR REPLACE FUNCTION public.processar_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  data_atual DATE;
  tipo_registro_valor VARCHAR(50);
BEGIN
  -- Determinar o tipo de registro baseado no tipo de afastamento
  SELECT 
    CASE 
      WHEN ta.remunerado = true THEN 'abono'
      ELSE 'falta'
    END
  INTO tipo_registro_valor
  FROM public.tipos_afastamento ta 
  WHERE ta.id = NEW.tipo_afastamento_id;

  -- Se é afastamento por dias, criar um registro para cada dia
  IF NEW.tipo_periodo = 'dias' THEN
    FOR i IN 0..(NEW.quantidade_dias - 1) LOOP
      data_atual := NEW.data_inicio + i;
      
      -- Inserir ou atualizar registro de ponto
      INSERT INTO public.registros_ponto 
        (funcionario_id, data, tipo_registro, observacoes)
      VALUES 
        (NEW.funcionario_id, data_atual, tipo_registro_valor, NEW.observacoes)
      ON CONFLICT (funcionario_id, data) 
      DO UPDATE SET 
        tipo_registro = tipo_registro_valor,
        observacoes = COALESCE(NEW.observacoes, ''),
        updated_at = now();
    END LOOP;
  
  -- Se é afastamento por horas, criar registro para o dia específico
  ELSIF NEW.tipo_periodo = 'horas' THEN
    INSERT INTO public.registros_ponto 
      (funcionario_id, data, tipo_registro, observacoes)
    VALUES 
      (NEW.funcionario_id, NEW.data_inicio, tipo_registro_valor, 
       COALESCE(NEW.observacoes, '') || ' (Afastamento: ' || NEW.quantidade_horas || 'h)')
    ON CONFLICT (funcionario_id, data) 
    DO UPDATE SET 
      tipo_registro = tipo_registro_valor,
      observacoes = COALESCE(NEW.observacoes, '') || ' (' || NEW.quantidade_horas || 'h)',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS trigger_processar_afastamento ON public.afastamentos;
CREATE TRIGGER trigger_processar_afastamento
  AFTER INSERT ON public.afastamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.processar_afastamento();

-- Corrigir a função gerar_folha_ponto_mensal para tratar abonos corretamente
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
RETURNS TABLE(funcionario_nome text, funcionario_cpf text, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas interval, horas_extras_diurnas interval, horas_extras_noturnas interval, faltas boolean, abonos boolean, observacoes text)
LANGUAGE plpgsql
AS $function$
DECLARE
  rec RECORD;
  dia_atual INTEGER;
  data_atual DATE;
  entrada_esperada TIME;
  saida_esperada TIME;
  horas_contratuais INTERVAL;
  horas_trabalhadas_dia INTERVAL;
  is_falta BOOLEAN;
  is_abono BOOLEAN;
BEGIN
  -- Buscar dados do funcionário e escala
  SELECT 
    f.nome_completo,
    f.cpf,
    f.funcao,
    e.nome,
    e.entrada,
    e.saida
  INTO 
    funcionario_nome,
    funcionario_cpf,
    funcionario_funcao,
    funcionario_escala_nome,
    funcionario_escala_entrada,
    funcionario_escala_saida
  FROM funcionarios f
  JOIN escalas e ON f.escala_id = e.id
  WHERE f.id = p_funcionario_id;

  -- Calcular horas contratuais por dia usando a nova função para turnos noturnos
  horas_contratuais := public.calcular_horas_trabalhadas_turno_noturno(
    funcionario_escala_entrada, 
    funcionario_escala_saida
  );

  -- Loop para cada dia do mês
  FOR dia_atual IN 1..31 LOOP
    -- Verificar se o dia existe no mês/ano
    BEGIN
      data_atual := make_date(p_ano, p_mes, dia_atual);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE; -- Pular dias que não existem (ex: 31 de fevereiro)
    END;

    -- Buscar registro de ponto do dia (incluindo turnos noturnos do dia anterior)
    SELECT 
      r.entrada,
      r.intervalo_inicio,
      r.intervalo_fim,
      r.saida,
      r.observacoes,
      r.tipo_registro
    INTO rec
    FROM registros_ponto r
    WHERE r.funcionario_id = p_funcionario_id 
    AND (
      r.data = data_atual OR 
      (r.data = data_atual - 1 AND r.entrada IS NOT NULL AND r.saida IS NOT NULL AND r.saida < r.entrada)
    )
    ORDER BY r.data DESC, r.created_at DESC
    LIMIT 1;

    -- Determinar se é falta ou abono baseado no tipo_registro
    IF rec.tipo_registro = 'falta' THEN
      is_falta := TRUE;
      is_abono := FALSE;
    ELSIF rec.tipo_registro = 'abono' OR rec.tipo_registro = 'falta_abonada' THEN
      is_falta := FALSE;
      is_abono := TRUE;
    ELSIF rec.entrada IS NULL AND rec.saida IS NULL AND rec.tipo_registro IS NULL THEN
      -- Verificar se deveria trabalhar neste dia baseado na escala
      SELECT deve_trabalhar INTO is_falta
      FROM public.preencher_horarios_por_escala(p_funcionario_id, data_atual, data_atual)
      WHERE data = data_atual;
      
      is_falta := COALESCE(is_falta, FALSE);
      is_abono := FALSE;
    ELSE
      is_falta := FALSE;
      is_abono := FALSE;
    END IF;

    -- Calcular horas trabalhadas do dia usando a nova função para turnos noturnos
    IF rec.entrada IS NOT NULL AND rec.saida IS NOT NULL THEN
      horas_trabalhadas_dia := public.calcular_horas_trabalhadas_turno_noturno(
        rec.entrada, 
        rec.saida, 
        rec.intervalo_inicio, 
        rec.intervalo_fim
      );
    ELSE
      horas_trabalhadas_dia := INTERVAL '0 hours';
    END IF;

    -- Retornar linha para o dia
    RETURN QUERY SELECT
      funcionario_nome,
      funcionario_cpf,
      funcionario_funcao,
      funcionario_escala_nome,
      funcionario_escala_entrada,
      funcionario_escala_saida,
      dia_atual,
      data_atual,
      rec.entrada,
      rec.intervalo_inicio,
      rec.intervalo_fim,
      rec.saida,
      horas_trabalhadas_dia,
      CASE 
        WHEN horas_trabalhadas_dia > horas_contratuais 
        THEN horas_trabalhadas_dia - horas_contratuais
        ELSE INTERVAL '0 hours'
      END as horas_extras_diurnas,
      INTERVAL '0 hours' as horas_extras_noturnas, -- Simplificado por enquanto
      is_falta,
      is_abono,
      rec.observacoes;
  END LOOP;
END;
$function$;