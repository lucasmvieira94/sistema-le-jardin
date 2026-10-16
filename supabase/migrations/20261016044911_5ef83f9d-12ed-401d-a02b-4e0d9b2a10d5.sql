CREATE TABLE public.portal_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tenant_id uuid,
  acesso_supervisor boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogada_em timestamptz
);
GRANT ALL ON public.portal_sessoes TO service_role;
ALTER TABLE public.portal_sessoes ENABLE ROW LEVEL SECURITY;
-- Sem políticas: acesso somente por funções do servidor.
CREATE INDEX portal_sessoes_func_idx ON public.portal_sessoes(funcionario_id);

-- Inicia a sessão do portal após validar o PIN; devolve um passe opaco (2 h)
CREATE OR REPLACE FUNCTION public.portal_iniciar_sessao(p_codigo text)
RETURNS TABLE(token text, expira_em timestamptz, funcionario_id uuid, nome_completo text, valid boolean,
  registra_ponto boolean, acesso_supervisor boolean, exigir_biometria boolean, biometria_facial jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE f record; v_token text; v_exp timestamptz := now() + interval '2 hours';
BEGIN
  SELECT * INTO f FROM public.funcionarios fu WHERE fu.codigo_4_digitos = p_codigo AND fu.ativo = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::timestamptz, NULL::uuid, NULL::text, false, true, false, true, NULL::jsonb;
    RETURN;
  END IF;
  DELETE FROM public.portal_sessoes s WHERE s.expira_em < now() - interval '1 day';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_sessoes(token_hash, funcionario_id, tenant_id, acesso_supervisor, expira_em)
  VALUES (encode(extensions.digest(v_token, 'sha256'), 'hex'), f.id, f.tenant_id, COALESCE(f.acesso_supervisor,false), v_exp);
  RETURN QUERY SELECT v_token, v_exp, f.id, f.nome_completo, true, COALESCE(f.registra_ponto,true),
    COALESCE(f.acesso_supervisor,false), COALESCE(f.exigir_biometria,true), f.biometria_facial;
END $$;
REVOKE ALL ON FUNCTION public.portal_iniciar_sessao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_iniciar_sessao(text) TO anon, authenticated;

-- Lê o passe enviado no cabeçalho x-portal-token
CREATE OR REPLACE FUNCTION public.portal_sessao_atual()
RETURNS public.portal_sessoes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_tok text; s public.portal_sessoes;
BEGIN
  BEGIN
    v_tok := current_setting('request.headers', true)::json ->> 'x-portal-token';
  EXCEPTION WHEN others THEN RETURN NULL; END;
  IF v_tok IS NULL OR length(v_tok) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.portal_sessoes ps
   WHERE ps.token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex')
     AND ps.revogada_em IS NULL AND ps.expira_em > now();
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.portal_funcionario_atual()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.portal_sessao_atual()).funcionario_id
$$;
CREATE OR REPLACE FUNCTION public.portal_eh_supervisor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((public.portal_sessao_atual()).acesso_supervisor, false)
$$;

CREATE OR REPLACE FUNCTION public.portal_encerrar_sessao()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.portal_sessoes := public.portal_sessao_atual();
BEGIN
  IF s.id IS NOT NULL THEN UPDATE public.portal_sessoes SET revogada_em = now() WHERE id = s.id; END IF;
END $$;

REVOKE ALL ON FUNCTION public.portal_sessao_atual() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_funcionario_atual() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_eh_supervisor() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_encerrar_sessao() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_funcionario_atual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_eh_supervisor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_encerrar_sessao() FROM PUBLIC;

-- Módulo 1: registro de ponto
DROP POLICY IF EXISTS "Anon can manage registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Allow select for active employees by funcionario_id" ON public.registros_ponto;
CREATE POLICY "Portal le os proprios registros" ON public.registros_ponto FOR SELECT TO anon
  USING (funcionario_id = public.portal_funcionario_atual() OR public.portal_eh_supervisor());
CREATE POLICY "Portal grava os proprios registros" ON public.registros_ponto FOR INSERT TO anon
  WITH CHECK (funcionario_id = public.portal_funcionario_atual());
CREATE POLICY "Portal atualiza os proprios registros" ON public.registros_ponto FOR UPDATE TO anon
  USING (funcionario_id = public.portal_funcionario_atual())
  WITH CHECK (funcionario_id = public.portal_funcionario_atual());