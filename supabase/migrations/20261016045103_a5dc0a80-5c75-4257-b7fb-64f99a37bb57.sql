CREATE OR REPLACE FUNCTION public.portal_iniciar_sessao(p_codigo text)
RETURNS TABLE(token text, expira_em timestamptz, funcionario_id uuid, nome_completo text, valid boolean,
  registra_ponto boolean, acesso_supervisor boolean, exigir_biometria boolean, biometria_facial jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record; v_token text; v_exp timestamptz := now() + interval '2 hours';
BEGIN
  SELECT * INTO f FROM public.funcionarios fu WHERE fu.codigo_4_digitos = p_codigo AND fu.ativo = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::timestamptz, NULL::uuid, NULL::text, false, true, false, true, NULL::jsonb;
    RETURN;
  END IF;
  DELETE FROM public.portal_sessoes s WHERE s.expira_em < now() - interval '1 day';
  v_token := encode(public.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_sessoes(token_hash, funcionario_id, tenant_id, acesso_supervisor, expira_em)
  VALUES (encode(public.digest(v_token, 'sha256'), 'hex'), f.id, f.tenant_id, COALESCE(f.acesso_supervisor,false), v_exp);
  RETURN QUERY SELECT v_token, v_exp, f.id, f.nome_completo, true, COALESCE(f.registra_ponto,true),
    COALESCE(f.acesso_supervisor,false), COALESCE(f.exigir_biometria,true), f.biometria_facial;
END $$;

CREATE OR REPLACE FUNCTION public.portal_sessao_atual()
RETURNS public.portal_sessoes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tok text; s public.portal_sessoes;
BEGIN
  BEGIN
    v_tok := current_setting('request.headers', true)::json ->> 'x-portal-token';
  EXCEPTION WHEN others THEN RETURN NULL; END;
  IF v_tok IS NULL OR length(v_tok) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.portal_sessoes ps
   WHERE ps.token_hash = encode(public.digest(v_tok, 'sha256'), 'hex')
     AND ps.revogada_em IS NULL AND ps.expira_em > now();
  RETURN s;
END $$;