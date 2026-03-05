
-- LIBERAR ACESSO TOTAL: registros_ponto
DROP POLICY IF EXISTS "Admins can manage registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Funcionarios can view own registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Funcionarios can insert own registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Funcionarios can update own registros_ponto" ON public.registros_ponto;
DROP POLICY IF EXISTS "Allow insert for active employees" ON public.registros_ponto;
DROP POLICY IF EXISTS "Allow select for active employees" ON public.registros_ponto;
DROP POLICY IF EXISTS "Allow update for active employees" ON public.registros_ponto;

CREATE POLICY "Authenticated full access registros_ponto"
  ON public.registros_ponto FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- LIBERAR ACESSO TOTAL: prontuario_registros
DROP POLICY IF EXISTS "Admins can manage prontuario_registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionarios podem visualizar registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionarios podem inserir registros" ON public.prontuario_registros;
DROP POLICY IF EXISTS "Funcionarios podem atualizar registros" ON public.prontuario_registros;

CREATE POLICY "Authenticated full access prontuario_registros"
  ON public.prontuario_registros FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- LIBERAR ACESSO TOTAL: prontuario_ciclos
DROP POLICY IF EXISTS "Admins can manage prontuario_ciclos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionarios podem visualizar ciclos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionarios podem criar ciclos" ON public.prontuario_ciclos;
DROP POLICY IF EXISTS "Funcionarios podem atualizar ciclos" ON public.prontuario_ciclos;

CREATE POLICY "Authenticated full access prontuario_ciclos"
  ON public.prontuario_ciclos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
