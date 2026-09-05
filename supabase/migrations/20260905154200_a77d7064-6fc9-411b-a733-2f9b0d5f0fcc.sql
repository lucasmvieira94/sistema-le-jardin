-- 1. Novas colunas
ALTER TABLE public.prontuario_registros
  ADD COLUMN IF NOT EXISTS imutavel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retifica_registro_id uuid REFERENCES public.prontuario_registros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa_retificacao text,
  ADD COLUMN IF NOT EXISTS funcionario_nome text;

CREATE INDEX IF NOT EXISTS idx_prontuario_registros_ciclo ON public.prontuario_registros(ciclo_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prontuario_registros_retifica ON public.prontuario_registros(retifica_registro_id);

-- Registros legados permanecem editáveis pelo fluxo antigo até serem migrados
UPDATE public.prontuario_registros SET imutavel = false WHERE created_at < now();

-- 2. Preencher nome do autor nos registros existentes
UPDATE public.prontuario_registros pr
SET funcionario_nome = f.nome_completo
FROM public.funcionarios f
WHERE f.id = pr.funcionario_id AND pr.funcionario_nome IS NULL;

-- 3. Trigger: impedir alteração/remoção de registros imutáveis
CREATE OR REPLACE FUNCTION public.impedir_alteracao_registro_prontuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.imutavel THEN
    INSERT INTO public.audit_log (user_id, tabela, operacao, dados_antigos)
    VALUES (
      auth.uid(),
      'prontuario_registros',
      'TENTATIVA_' || TG_OP || '_BLOQUEADA',
      to_jsonb(OLD)
    );
    RAISE EXCEPTION 'Registro de prontuário é imutável e não pode ser alterado ou removido. Utilize uma retificação.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prontuario_registros_imutavel ON public.prontuario_registros;
CREATE TRIGGER trg_prontuario_registros_imutavel
BEFORE UPDATE OR DELETE ON public.prontuario_registros
FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_registro_prontuario();

-- 4. Trigger: só aceitar lançamentos no ciclo do dia corrente e aberto
CREATE OR REPLACE FUNCTION public.validar_janela_ciclo_prontuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status varchar;
  v_data date;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NEW.ciclo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, data_ciclo INTO v_status, v_data
  FROM public.prontuario_ciclos WHERE id = NEW.ciclo_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Prontuário do dia não encontrado.';
  END IF;

  IF v_status = 'encerrado' OR v_data <> v_hoje THEN
    RAISE EXCEPTION 'Este prontuário já foi encerrado e não aceita novos lançamentos.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prontuario_registros_janela ON public.prontuario_registros;
CREATE TRIGGER trg_prontuario_registros_janela
BEFORE INSERT ON public.prontuario_registros
FOR EACH ROW EXECUTE FUNCTION public.validar_janela_ciclo_prontuario();

-- 5. Função de lançamento (append-only)
CREATE OR REPLACE FUNCTION public.registrar_lancamento_prontuario(
  p_residente_id uuid,
  p_funcionario_id uuid,
  p_conteudo jsonb,
  p_titulo text DEFAULT 'Lançamento do prontuário',
  p_retifica_id uuid DEFAULT NULL,
  p_justificativa text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, registro_id uuid, ciclo_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_ciclo uuid;
  v_registro uuid;
  v_nome text;
  v_tenant uuid;
BEGIN
  SELECT nome_completo, tenant_id INTO v_nome, v_tenant
  FROM public.funcionarios WHERE id = p_funcionario_id AND ativo = true;

  IF v_nome IS NULL THEN
    RETURN QUERY SELECT false, 'Funcionário não encontrado ou inativo'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF p_retifica_id IS NOT NULL AND coalesce(btrim(p_justificativa), '') = '' THEN
    RETURN QUERY SELECT false, 'Justificativa obrigatória para retificação'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT id INTO v_ciclo
  FROM public.prontuario_ciclos
  WHERE residente_id = p_residente_id AND data_ciclo = v_hoje
  ORDER BY created_at DESC LIMIT 1;

  IF v_ciclo IS NULL THEN
    INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status, data_inicio_efetivo, tenant_id)
    VALUES (v_hoje, p_residente_id, 'em_andamento', v_agora, v_tenant)
    RETURNING id INTO v_ciclo;
  ELSE
    UPDATE public.prontuario_ciclos
    SET status = CASE WHEN status = 'encerrado' THEN status ELSE 'em_andamento' END,
        data_inicio_efetivo = COALESCE(data_inicio_efetivo, v_agora),
        updated_at = now()
    WHERE id = v_ciclo;
  END IF;

  INSERT INTO public.prontuario_registros (
    residente_id, funcionario_id, funcionario_nome, data_registro, horario_registro,
    tipo_registro, titulo, descricao, ciclo_id, imutavel,
    retifica_registro_id, justificativa_retificacao, tenant_id
  ) VALUES (
    p_residente_id, p_funcionario_id, v_nome, v_hoje, v_agora::time,
    CASE WHEN p_retifica_id IS NULL THEN 'lancamento' ELSE 'retificacao' END,
    p_titulo, p_conteudo::text, v_ciclo, true,
    p_retifica_id, p_justificativa, v_tenant
  )
  RETURNING id INTO v_registro;

  RETURN QUERY SELECT true, 'Lançamento registrado com sucesso'::text, v_registro, v_ciclo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_lancamento_prontuario(uuid, uuid, jsonb, text, uuid, text) TO anon, authenticated, service_role;

-- 6. Fechamento automático dos dias anteriores
CREATE OR REPLACE FUNCTION public.redefinir_prontuarios_com_horario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  UPDATE public.prontuario_ciclos
  SET status = 'encerrado',
      data_encerramento = COALESCE(data_encerramento, now() AT TIME ZONE 'America/Sao_Paulo'),
      updated_at = now()
  WHERE data_ciclo < v_hoje
    AND status <> 'encerrado';
END;
$$;
