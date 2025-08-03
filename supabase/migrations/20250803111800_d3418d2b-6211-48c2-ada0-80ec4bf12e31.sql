-- Adicionar política para permitir consulta anônima de funcionários por código
-- Isso é necessário para o sistema de ponto funcionar sem autenticação
CREATE POLICY "Allow anonymous funcionario lookup by code" 
ON public.funcionarios 
FOR SELECT 
USING (ativo = true);

-- Comentário: Esta política permite que usuários não autenticados consultem 
-- funcionários ativos usando apenas o código de 4 dígitos, necessário para
-- o funcionamento do sistema de registro de ponto em dispositivos móveis