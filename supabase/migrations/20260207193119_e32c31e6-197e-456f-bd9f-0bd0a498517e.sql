
-- Finalizar todos os prontuários em atraso (ciclos de dias anteriores não encerrados)
UPDATE prontuario_ciclos 
SET status = 'encerrado', 
    data_encerramento = now(), 
    updated_at = now() 
WHERE status IN ('em_andamento', 'nao_iniciado') 
  AND data_ciclo < CURRENT_DATE;
