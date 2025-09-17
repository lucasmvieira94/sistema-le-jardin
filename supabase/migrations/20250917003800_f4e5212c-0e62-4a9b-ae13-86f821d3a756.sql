-- Adicionar política para admins gerenciarem todos os ciclos
CREATE POLICY "Admins podem inserir qualquer ciclo"
ON public.prontuario_ciclos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Inserir ciclos restantes usando função administrativa
DO $$
DECLARE
  residente_record RECORD;
  ciclos_criados INTEGER := 0;
BEGIN
  FOR residente_record IN 
    SELECT r.id FROM residentes r 
    WHERE r.ativo = true 
    AND NOT EXISTS (
      SELECT 1 FROM prontuario_ciclos pc 
      WHERE pc.data_ciclo = CURRENT_DATE 
      AND pc.residente_id = r.id
    )
  LOOP
    INSERT INTO prontuario_ciclos (data_ciclo, residente_id, status, created_at, updated_at)
    VALUES (CURRENT_DATE, residente_record.id, 'nao_iniciado', NOW(), NOW());
    ciclos_criados := ciclos_criados + 1;
  END LOOP;
  
  RAISE NOTICE 'Criados % ciclos adicionais', ciclos_criados;
END $$;