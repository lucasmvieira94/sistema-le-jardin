-- Primeiro, remover o constraint existente e criar um novo que inclui 'nao_iniciado'
ALTER TABLE prontuario_ciclos DROP CONSTRAINT IF EXISTS prontuario_ciclos_status_check;

-- Adicionar novo constraint com todos os status válidos
ALTER TABLE prontuario_ciclos 
ADD CONSTRAINT prontuario_ciclos_status_check 
CHECK (status IN ('nao_iniciado', 'em_andamento', 'completo', 'encerrado'));

-- Função para verificar e atualizar status de prontuários diariamente
-- Remove prontuários antigos e cria novos ciclos diários automaticamente
CREATE OR REPLACE FUNCTION redefinir_status_prontuarios_diarios()
RETURNS void AS $$
DECLARE
  data_hoje DATE := CURRENT_DATE;
BEGIN
  -- Log da execução
  RAISE NOTICE 'Redefinindo status de prontuários para data: %', data_hoje;
  
  -- Atualizar prontuários que ainda estão 'em_andamento' do dia anterior para 'nao_finalizado'
  UPDATE prontuario_ciclos 
  SET status = 'encerrado', 
      updated_at = NOW()
  WHERE data_ciclo < data_hoje 
    AND status = 'em_andamento';

  -- Inserir novos ciclos para residentes ativos (apenas se não existir para hoje)
  INSERT INTO prontuario_ciclos (residente_id, data_ciclo, status, created_at, updated_at)
  SELECT 
    r.id,
    data_hoje,
    'nao_iniciado',
    NOW(),
    NOW()
  FROM residentes r
  WHERE r.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM prontuario_ciclos pc 
      WHERE pc.residente_id = r.id 
        AND pc.data_ciclo = data_hoje
    );

  RAISE NOTICE 'Status de prontuários redefinidos com sucesso';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar execução diária às 8:00 AM (horário UTC-3 = 11:00 UTC)
SELECT cron.schedule(
  'redefinir-prontuarios-diarios',
  '0 11 * * *', -- 11:00 UTC = 8:00 AM Brasília
  $$
  SELECT redefinir_status_prontuarios_diarios();
  $$
);

-- Atualizar a função de verificação para considerar a data correta
CREATE OR REPLACE FUNCTION verificar_prontuario_diario_existente(p_residente_id UUID)
RETURNS TABLE (
  ja_iniciado BOOLEAN,
  ciclo_id UUID,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN pc.id IS NOT NULL THEN true ELSE false END as ja_iniciado,
    pc.id as ciclo_id,
    COALESCE(pc.status, 'nao_iniciado') as status
  FROM prontuario_ciclos pc
  WHERE pc.residente_id = p_residente_id 
    AND pc.data_ciclo = CURRENT_DATE
  ORDER BY pc.created_at DESC
  LIMIT 1;
  
  -- Se não encontrou nenhum registro, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'nao_iniciado'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar redefinição inicial para garantir que os dados estão corretos
SELECT redefinir_status_prontuarios_diarios();