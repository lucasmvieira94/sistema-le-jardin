CREATE POLICY "Somente servidor acessa controle do consultor" ON public.consultor_painel_execucoes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);