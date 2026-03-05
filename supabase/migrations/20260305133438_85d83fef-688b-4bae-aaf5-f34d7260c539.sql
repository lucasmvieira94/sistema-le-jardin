
-- Permitir acesso anon para registros_ponto (funcionários via código)
CREATE POLICY "Anon can manage registros_ponto"
  ON public.registros_ponto FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Permitir acesso anon para prontuario_registros
CREATE POLICY "Anon can manage prontuario_registros"
  ON public.prontuario_registros FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Permitir acesso anon para prontuario_ciclos
CREATE POLICY "Anon can manage prontuario_ciclos"
  ON public.prontuario_ciclos FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Permitir anon ler residentes (necessário para prontuário)
CREATE POLICY "Anon can view residentes"
  ON public.residentes FOR SELECT TO anon
  USING (true);

-- Permitir anon ler templates de prontuário
CREATE POLICY "Anon can view prontuario_templates"
  ON public.prontuario_templates_obrigatorios FOR SELECT TO anon
  USING (ativo = true);

-- Permitir anon ler configurações de prontuário
CREATE POLICY "Anon can view configuracoes_prontuario"
  ON public.configuracoes_prontuario FOR SELECT TO anon
  USING (true);

-- Permitir anon ler/inserir controle de temperatura
CREATE POLICY "Anon can manage temperatura"
  ON public.controle_temperatura_medicamentos FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Permitir anon ler/atualizar estoque de fraldas
CREATE POLICY "Anon can view estoque_fraldas"
  ON public.estoque_fraldas FOR SELECT TO anon
  USING (ativo = true);

CREATE POLICY "Anon can update estoque_fraldas"
  ON public.estoque_fraldas FOR UPDATE TO anon
  USING (ativo = true);

-- Permitir anon ler configurações da empresa (logo, nome)
CREATE POLICY "Anon can view configuracoes_empresa"
  ON public.configuracoes_empresa FOR SELECT TO anon
  USING (true);

-- Permitir anon ler escalas (necessário para registro de ponto)
CREATE POLICY "Anon can view escalas"
  ON public.escalas FOR SELECT TO anon
  USING (true);
