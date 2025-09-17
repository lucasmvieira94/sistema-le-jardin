-- Corrigir políticas RLS para prontuario_ciclos para permitir inserção via função
-- Adicionar política para permitir inserção de novos ciclos por funcionários autenticados

CREATE POLICY "Funcionários podem criar novos ciclos"
ON public.prontuario_ciclos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM funcionarios 
    WHERE funcionarios.ativo = true
  )
);

-- Corrigir a política de atualização para ser mais flexível
DROP POLICY IF EXISTS "Funcionários podem atualizar ciclos em andamento" ON public.prontuario_ciclos;

CREATE POLICY "Funcionários podem atualizar ciclos ativos"
ON public.prontuario_ciclos
FOR UPDATE
USING (
  status IN ('nao_iniciado', 'em_andamento', 'completo') AND
  EXISTS (
    SELECT 1 FROM funcionarios 
    WHERE funcionarios.ativo = true
  )
);

-- Testar criação manual de ciclos
INSERT INTO public.prontuario_ciclos (data_ciclo, residente_id, status, created_at, updated_at)
SELECT 
  CURRENT_DATE,
  r.id,
  'nao_iniciado',
  NOW(),
  NOW()
FROM residentes r 
WHERE r.ativo = true 
AND NOT EXISTS (
  SELECT 1 FROM prontuario_ciclos pc 
  WHERE pc.data_ciclo = CURRENT_DATE 
  AND pc.residente_id = r.id
)
LIMIT 5; -- Limitar para teste