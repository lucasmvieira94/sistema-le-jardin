CREATE OR REPLACE FUNCTION public.registrar_lancamento_prontuario(
  p_residente_id uuid,
  p_funcionario_id uuid,
  p_conteudo jsonb,
  p_titulo text DEFAULT 'Lançamento do prontuário'::text,
  p_retifica_id uuid DEFAULT NULL::uuid,
  p_justificativa text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, message text, registro_id uuid, ciclo_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_agora timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_ciclo uuid;
  v_registro uuid;
  v_nome text;
  v_tenant uuid;
  v_descricao text;
  v_conteudo_existente jsonb;
  v_chaves_novas text[];
  v_chaves_duplicadas text[] := ARRAY[]::text[];
  v_retificacao_valida boolean;
BEGIN
  IF p_conteudo IS NULL OR jsonb_typeof(p_conteudo) <> 'object' OR p_conteudo = '{}'::jsonb THEN
    RETURN QUERY SELECT false, 'Informe ao menos uma resposta para registrar'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT f.nome_completo, f.tenant_id INTO v_nome, v_tenant
  FROM public.funcionarios AS f
  WHERE f.id = p_funcionario_id AND f.ativo = true;

  IF v_nome IS NULL THEN
    RETURN QUERY SELECT false, 'Funcionário não encontrado ou inativo'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF p_retifica_id IS NOT NULL AND coalesce(btrim(p_justificativa), '') = '' THEN
    RETURN QUERY SELECT false, 'Justificativa obrigatória para retificação'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_residente_id::text || ':' || v_hoje::text, 0));

  SELECT pc.id INTO v_ciclo
  FROM public.prontuario_ciclos AS pc
  WHERE pc.residente_id = p_residente_id AND pc.data_ciclo = v_hoje
  ORDER BY pc.created_at DESC
  LIMIT 1;

  IF v_ciclo IS NULL THEN
    INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status, data_inicio_efetivo, tenant_id)
    VALUES (v_hoje, p_residente_id, 'em_andamento', v_agora, v_tenant)
    RETURNING prontuario_ciclos.id INTO v_ciclo;
  ELSE
    UPDATE public.prontuario_ciclos AS pc
    SET status = CASE WHEN pc.status = 'encerrado' THEN pc.status ELSE 'em_andamento' END,
        data_inicio_efetivo = COALESCE(pc.data_inicio_efetivo, v_agora),
        updated_at = now()
    WHERE pc.id = v_ciclo;
  END IF;

  IF p_retifica_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.prontuario_registros AS pr
      WHERE pr.id = p_retifica_id
        AND pr.ciclo_id = v_ciclo
        AND pr.residente_id = p_residente_id
        AND pr.retifica_registro_id IS NULL
        AND pr.tipo_registro IN ('lancamento', 'prontuario_completo')
    ) INTO v_retificacao_valida;

    IF NOT v_retificacao_valida THEN
      RETURN QUERY SELECT false, 'O registro original não pertence ao prontuário aberto deste residente'::text, NULL::uuid, v_ciclo;
      RETURN;
    END IF;
  ELSE
    SELECT array_agg(chave) INTO v_chaves_novas
    FROM jsonb_object_keys(p_conteudo) AS chave;

    FOR v_descricao IN
      SELECT pr.descricao
      FROM public.prontuario_registros AS pr
      WHERE pr.ciclo_id = v_ciclo
        AND pr.residente_id = p_residente_id
        AND pr.retifica_registro_id IS NULL
        AND pr.tipo_registro IN ('lancamento', 'prontuario_completo')
    LOOP
      BEGIN
        v_conteudo_existente := v_descricao::jsonb;
      EXCEPTION WHEN OTHERS THEN
        v_conteudo_existente := '{}'::jsonb;
      END;

      IF jsonb_typeof(v_conteudo_existente) = 'object' THEN
        SELECT ARRAY(
          SELECT DISTINCT chave
          FROM unnest(v_chaves_novas) AS chave
          WHERE v_conteudo_existente ? chave
            AND NOT (
              v_conteudo_existente -> chave IS NULL
              OR v_conteudo_existente -> chave = 'null'::jsonb
              OR v_conteudo_existente -> chave = '""'::jsonb
            )
        ) INTO v_chaves_duplicadas;

        IF cardinality(v_chaves_duplicadas) > 0 THEN
          RETURN QUERY SELECT false, 'Uma ou mais perguntas já foram respondidas hoje. Use a opção Retificar no registro original.'::text, NULL::uuid, v_ciclo;
          RETURN;
        END IF;
      END IF;
    END LOOP;
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
  RETURNING prontuario_registros.id INTO v_registro;

  RETURN QUERY SELECT true,
    CASE WHEN p_retifica_id IS NULL THEN 'Lançamento registrado com sucesso' ELSE 'Retificação registrada com sucesso' END::text,
    v_registro, v_ciclo;
END;
$function$;