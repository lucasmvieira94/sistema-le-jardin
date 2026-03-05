
-- =============================================
-- FIX registros_ponto: converter policies para PERMISSIVE
-- =============================================

-- Drop todas as policies restritivas existentes
DROP POLICY IF EXISTS "Admins can delete registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Admins can insert any registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Admins can update any registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Admins can view all registros_ponto" ON public.registros_ponto;

-- Recriar como PERMISSIVE + adicionar policies para funcionários
CREATE POLICY "Admins can manage registros_ponto"
  ON public.registros_ponto FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Funcionarios can view own registros_ponto"
  ON public.registros_ponto FOR SELECT
  USING (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid() AND ativo = true
  ));

CREATE POLICY "Funcionarios can insert own registros_ponto"
  ON public.registros_ponto FOR INSERT
  WITH CHECK (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid() AND ativo = true
  ));

CREATE POLICY "Funcionarios can update own registros_ponto"
  ON public.registros_ponto FOR UPDATE
  USING (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid() AND ativo = true
  ));

-- =============================================
-- FIX prontuario_registros: converter policies para PERMISSIVE
-- =============================================

DROP POLICY IF EXISTS "Admins can manage prontuario_registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionários podem atualizar seus registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionários podem inserir registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionários podem visualizar todos os registros" ON public.prontuario_registros;

CREATE POLICY "Admins can manage prontuario_registros"
  ON public.prontuario_registros FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Funcionarios podem visualizar registros"
  ON public.prontuario_registros FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios WHERE funcionarios.ativo = true AND funcionarios.user_id = auth.uid()
  ));

CREATE POLICY "Funcionarios podem inserir registros"
  ON public.prontuario_registros FOR INSERT
  WITH CHECK (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true AND user_id = auth.uid()
  ));

CREATE POLICY "Funcionarios podem atualizar registros"
  ON public.prontuario_registros FOR UPDATE
  USING (funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE ativo = true AND user_id = auth.uid()
  ));

-- =============================================
-- FIX prontuario_ciclos: converter policies para PERMISSIVE
-- =============================================

DROP POLICY IF EXISTS "Admins podem gerenciar ciclos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Admins podem inserir qualquer ciclo" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionários podem atualizar ciclos ativos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionários podem criar novos ciclos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionários podem visualizar ciclos" ON public.prontuario_ciclos;

CREATE POLICY "Admins can manage prontuario_ciclos"
  ON public.prontuario_ciclos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Funcionarios podem visualizar ciclos"
  ON public.prontuario_ciclos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios WHERE funcionarios.ativo = true AND funcionarios.user_id = auth.uid()
  ));

CREATE POLICY "Funcionarios podem criar ciclos"
  ON public.prontuario_ciclos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios WHERE funcionarios.ativo = true AND funcionarios.user_id = auth.uid()
  ));

CREATE POLICY "Funcionarios podem atualizar ciclos"
  ON public.prontuario_ciclos FOR UPDATE
  USING (
    status IN ('nao_iniciado', 'em_andamento', 'completo')
    AND EXISTS (
      SELECT 1 FROM public.funcionarios WHERE funcionarios.ativo = true AND funcionarios.user_id = auth.uid()
    )
  );
