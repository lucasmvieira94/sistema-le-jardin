
-- Permite INSERT para usuários autenticados na tabela escalas
CREATE POLICY "Permite insert para usuarios autenticados" ON public.escalas
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
