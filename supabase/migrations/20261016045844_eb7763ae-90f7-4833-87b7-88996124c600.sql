DROP POLICY IF EXISTS "Anon can manage prontuario_registros" ON public.prontuario_registros;
CREATE POLICY "Portal gerencia prontuario_registros" ON public.prontuario_registros FOR ALL TO anon
  USING (public.portal_funcionario_atual() IS NOT NULL)
  WITH CHECK (public.portal_funcionario_atual() IS NOT NULL);

DROP POLICY IF EXISTS "Anon can manage prontuario_ciclos" ON public.prontuario_ciclos;
CREATE POLICY "Portal gerencia prontuario_ciclos" ON public.prontuario_ciclos FOR ALL TO anon
  USING (public.portal_funcionario_atual() IS NOT NULL)
  WITH CHECK (public.portal_funcionario_atual() IS NOT NULL);

DROP POLICY IF EXISTS "Anon can view configuracoes_prontuario" ON public.configuracoes_prontuario;
CREATE POLICY "Portal le configuracoes_prontuario" ON public.configuracoes_prontuario FOR SELECT TO anon
  USING (public.portal_funcionario_atual() IS NOT NULL);