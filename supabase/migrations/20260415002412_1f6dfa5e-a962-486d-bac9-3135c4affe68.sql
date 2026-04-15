-- Allow anon to insert medication administrations (employee public access)
CREATE POLICY "Anon pode inserir administracoes"
ON public.administracao_medicamentos
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to view medication administrations
CREATE POLICY "Anon pode visualizar administracoes"
ON public.administracao_medicamentos
FOR SELECT
TO anon
USING (true);

-- Allow anon to view prescriptions (needed for the medication map)
CREATE POLICY "Anon pode visualizar prescricoes"
ON public.prescricoes_medicamentos
FOR SELECT
TO anon
USING (ativo = true);

-- Allow anon to view medicamentos catalog
CREATE POLICY "Anon pode visualizar medicamentos"
ON public.medicamentos
FOR SELECT
TO anon
USING (ativo = true);

-- Allow anon to view estoque (for auto-deduction)
CREATE POLICY "Anon pode visualizar estoque"
ON public.estoque_medicamentos
FOR SELECT
TO anon
USING (ativo = true);

-- Allow anon to update estoque (trigger needs this for auto-deduction)
CREATE POLICY "Anon pode atualizar estoque"
ON public.estoque_medicamentos
FOR UPDATE
TO anon
USING (ativo = true);

-- Allow anon to view residentes for medication map
CREATE POLICY "Anon pode visualizar residentes ativos"
ON public.residentes
FOR SELECT
TO anon
USING (ativo = true);
