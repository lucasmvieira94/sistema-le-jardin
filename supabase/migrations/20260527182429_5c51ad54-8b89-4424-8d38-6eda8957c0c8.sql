
-- 1) Novas colunas em funcionarios
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_desligamento date,
  ADD COLUMN IF NOT EXISTS motivo_desligamento text,
  ADD COLUMN IF NOT EXISTS aviso_previo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_aviso_previo text,
  ADD COLUMN IF NOT EXISTS modalidade_reducao_aviso text,
  ADD COLUMN IF NOT EXISTS data_inicio_aviso date,
  ADD COLUMN IF NOT EXISTS data_fim_aviso date,
  ADD COLUMN IF NOT EXISTS observacoes_desligamento text,
  ADD COLUMN IF NOT EXISTS desligado_por uuid;

ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS chk_motivo_desligamento;
ALTER TABLE public.funcionarios ADD CONSTRAINT chk_motivo_desligamento CHECK (
  motivo_desligamento IS NULL OR motivo_desligamento IN (
    'pedido_demissao','sem_justa_causa','com_justa_causa',
    'acordo_mutuo','termino_contrato','aposentadoria','falecimento'
  )
);
ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS chk_tipo_aviso_previo;
ALTER TABLE public.funcionarios ADD CONSTRAINT chk_tipo_aviso_previo CHECK (
  tipo_aviso_previo IS NULL OR tipo_aviso_previo IN ('trabalhado','indenizado','dispensado')
);
ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS chk_modalidade_reducao_aviso;
ALTER TABLE public.funcionarios ADD CONSTRAINT chk_modalidade_reducao_aviso CHECK (
  modalidade_reducao_aviso IS NULL OR modalidade_reducao_aviso IN (
    'reducao_2h_entrada','reducao_2h_saida','reducao_7_dias_corridos'
  )
);

CREATE INDEX IF NOT EXISTS idx_funcionarios_data_desligamento
  ON public.funcionarios(data_desligamento) WHERE data_desligamento IS NOT NULL;

-- 2) Tabela de histórico de desligamentos
CREATE TABLE IF NOT EXISTS public.desligamentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL,
  tenant_id uuid,
  data_desligamento date NOT NULL,
  motivo_desligamento text NOT NULL,
  aviso_previo boolean NOT NULL DEFAULT false,
  tipo_aviso_previo text,
  modalidade_reducao_aviso text,
  data_inicio_aviso date,
  data_fim_aviso date,
  observacoes text,
  snapshot_funcionario jsonb,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.desligamentos_historico TO authenticated;
GRANT ALL ON public.desligamentos_historico TO service_role;

ALTER TABLE public.desligamentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam desligamentos" ON public.desligamentos_historico;
CREATE POLICY "Admins gerenciam desligamentos"
  ON public.desligamentos_historico
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Funcionario ve proprio desligamento" ON public.desligamentos_historico;
CREATE POLICY "Funcionario ve proprio desligamento"
  ON public.desligamentos_historico
  FOR SELECT TO authenticated
  USING (funcionario_id IN (SELECT id FROM public.funcionarios WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_desligamentos_funcionario ON public.desligamentos_historico(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_desligamentos_tenant ON public.desligamentos_historico(tenant_id);

-- 3) Tipo de afastamento "Aviso prévio - redução 7 dias" (código curto)
INSERT INTO public.tipos_afastamento (codigo, descricao, categoria, remunerado, tenant_id)
SELECT 'AVPREV', 'Aviso prévio - redução 7 dias corridos', 'clt', true, t.tenant_id
FROM (SELECT DISTINCT tenant_id FROM public.tipos_afastamento WHERE tenant_id IS NOT NULL) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_afastamento ta
  WHERE ta.tenant_id = t.tenant_id AND ta.codigo = 'AVPREV'
);

-- 4) Atualizar gerar_folha_ponto_mensal para respeitar data_desligamento
CREATE OR REPLACE FUNCTION public.gerar_folha_ponto_mensal(p_funcionario_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(funcionario_nome text, funcionario_cpf character varying, funcionario_funcao text, funcionario_escala_nome text, funcionario_escala_entrada time without time zone, funcionario_escala_saida time without time zone, dia integer, data date, entrada time without time zone, intervalo_inicio time without time zone, intervalo_fim time without time zone, saida time without time zone, horas_trabalhadas text, horas_extras_diurnas text, horas_extras_noturnas text, faltas boolean, abonos boolean, observacoes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    dias_no_mes INTEGER;
    dia_atual INTEGER;
    data_atual DATE;
    funcionario_record RECORD;
    registro_record RECORD;
    afastamento_exists boolean;
    calc_horas_trabalhadas text;
    calc_horas_extras_diurnas text;
    calc_horas_noturnas text;
    calc_faltas boolean;
    calc_abonos boolean;
    dia_semana INTEGER;
    deve_trabalhar boolean;
    jornada text;
    data_vigencia date;
    data_deslig date;
BEGIN
    SELECT 
        f.nome_completo, f.cpf, f.funcao,
        f.data_inicio_vigencia, f.data_admissao, f.data_desligamento,
        e.nome as escala_nome, e.entrada as escala_entrada,
        e.saida as escala_saida, e.intervalo_inicio as escala_intervalo_inicio,
        e.intervalo_fim as escala_intervalo_fim, e.jornada_trabalho
    INTO funcionario_record
    FROM funcionarios f
    JOIN escalas e ON f.escala_id = e.id
    WHERE f.id = p_funcionario_id;

    IF NOT FOUND THEN RETURN; END IF;

    jornada := funcionario_record.jornada_trabalho;
    data_vigencia := COALESCE(funcionario_record.data_inicio_vigencia, funcionario_record.data_admissao);
    data_deslig := funcionario_record.data_desligamento;
    dias_no_mes := EXTRACT(DAY FROM (DATE_TRUNC('month', DATE(p_ano || '-' || p_mes || '-01')) + INTERVAL '1 month' - INTERVAL '1 day'));

    FOR dia_atual IN 1..dias_no_mes LOOP
        data_atual := DATE(p_ano || '-' || LPAD(p_mes::TEXT, 2, '0') || '-' || LPAD(dia_atual::TEXT, 2, '0'));
        
        calc_horas_trabalhadas := '00:00:00';
        calc_horas_extras_diurnas := '00:00:00';
        calc_horas_noturnas := '00:00:00';
        calc_faltas := false;
        calc_abonos := false;
        
        dia_semana := EXTRACT(DOW FROM data_atual);
        deve_trabalhar := false;
        
        IF jornada = '40h_8h_segsex' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        ELSIF jornada = '44h_8h_segsab' OR jornada = '44h_8h_segsex_4h_sab' THEN
            deve_trabalhar := dia_semana BETWEEN 1 AND 6;
        ELSIF jornada = '12x36' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 2 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '24x72' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 4 = 0;
            ELSE deve_trabalhar := true; END IF;
        ELSIF jornada = '6x1' OR jornada = '36h_6h_seg_sab' THEN
            IF data_vigencia IS NOT NULL AND data_atual >= data_vigencia THEN
                deve_trabalhar := (data_atual - data_vigencia) % 7 != 6;
            ELSE deve_trabalhar := dia_semana BETWEEN 1 AND 6; END IF;
        ELSE
            deve_trabalhar := dia_semana BETWEEN 1 AND 5;
        END IF;

        IF data_vigencia IS NOT NULL AND data_atual < data_vigencia THEN
            deve_trabalhar := false;
        END IF;

        -- Não considera dias posteriores ao desligamento
        IF data_deslig IS NOT NULL AND data_atual > data_deslig THEN
            deve_trabalhar := false;
        END IF;
        
        SELECT rp.entrada, rp.intervalo_inicio, rp.intervalo_fim, rp.saida, rp.observacoes
        INTO registro_record
        FROM registros_ponto rp
        WHERE rp.funcionario_id = p_funcionario_id AND rp.data = data_atual
        LIMIT 1;

        SELECT EXISTS(
            SELECT 1 FROM afastamentos a
            WHERE a.funcionario_id = p_funcionario_id
            AND data_atual BETWEEN a.data_inicio AND COALESCE(a.data_fim, a.data_inicio)
        ) INTO afastamento_exists;

        IF registro_record.observacoes ILIKE '%abono%' THEN
            calc_abonos := true;
        ELSIF registro_record.observacoes ILIKE '%falta%' THEN
            calc_faltas := true;
        ELSIF afastamento_exists THEN
            calc_abonos := true;
        ELSIF registro_record.entrada IS NOT NULL AND registro_record.saida IS NOT NULL THEN
            BEGIN
                SELECT COALESCE(calcular_horas_trabalhadas(registro_record.entrada, registro_record.saida, registro_record.intervalo_inicio, registro_record.intervalo_fim)::text, '00:00:00')
                INTO calc_horas_trabalhadas;
            EXCEPTION WHEN OTHERS THEN calc_horas_trabalhadas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(calcular_horas_extras_diurnas(registro_record.entrada, registro_record.intervalo_inicio, registro_record.intervalo_fim, registro_record.saida, funcionario_record.escala_entrada, funcionario_record.escala_saida)::text, '00:00:00')
                INTO calc_horas_extras_diurnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_extras_diurnas := '00:00:00'; END;
            
            BEGIN
                SELECT COALESCE(calcular_horas_noturnas(
                    registro_record.entrada, registro_record.saida, 
                    registro_record.intervalo_inicio, registro_record.intervalo_fim
                )::text, '00:00:00')
                INTO calc_horas_noturnas;
            EXCEPTION WHEN OTHERS THEN calc_horas_noturnas := '00:00:00'; END;
        ELSIF deve_trabalhar AND registro_record.entrada IS NULL AND registro_record.saida IS NULL THEN
            calc_faltas := true;
        END IF;

        funcionario_nome := funcionario_record.nome_completo;
        funcionario_cpf := funcionario_record.cpf;
        funcionario_funcao := funcionario_record.funcao;
        funcionario_escala_nome := funcionario_record.escala_nome;
        funcionario_escala_entrada := funcionario_record.escala_entrada;
        funcionario_escala_saida := funcionario_record.escala_saida;
        dia := dia_atual;
        data := data_atual;
        entrada := registro_record.entrada;
        intervalo_inicio := registro_record.intervalo_inicio;
        intervalo_fim := registro_record.intervalo_fim;
        saida := registro_record.saida;
        horas_trabalhadas := calc_horas_trabalhadas;
        horas_extras_diurnas := calc_horas_extras_diurnas;
        horas_extras_noturnas := calc_horas_noturnas;
        faltas := calc_faltas;
        abonos := calc_abonos;
        observacoes := registro_record.observacoes;

        RETURN NEXT;
    END LOOP;
END;
$function$;
