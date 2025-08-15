-- Habilitar extensões necessárias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para gerar prontuários diários às 7h00
SELECT cron.schedule(
  'gerar-prontuario-diario',
  '0 7 * * *', -- Todos os dias às 7h00
  $$
  SELECT
    net.http_post(
        url:='https://kvjgmqicictxxfnvhuwl.supabase.co/functions/v1/gerar-prontuario-diario',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2amdtcWljaWN0eHhmbnZodXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5NDU3NzIsImV4cCI6MjA2NTUyMTc3Mn0.gGPP76kvvjC6pKZMV9mbJawcccGKdMnLT1SLq6s56rY"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Função para executar manualmente a criação de prontuários (para teste)
CREATE OR REPLACE FUNCTION public.executar_criacao_prontuarios_manual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.criar_ciclo_prontuario_diario();
END;
$$;