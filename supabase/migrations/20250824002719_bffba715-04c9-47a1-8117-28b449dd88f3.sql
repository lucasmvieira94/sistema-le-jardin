-- Executar a criação manual de prontuários para hoje
SELECT public.redefinir_prontuarios_automatico();

-- Verificar se os ciclos foram criados
SELECT COUNT(*) as total_ciclos_hoje FROM public.prontuario_ciclos WHERE data_ciclo = CURRENT_DATE;

-- Configurar a execução automática usando pg_cron (caso ainda não esteja configurada)
-- Primeiro, verificar se as extensões estão habilitadas
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- Criar o job cron para executar às 08:00 todos os dias (horário de Brasília)
-- Note: O Supabase usa UTC, então 08:00 BRT = 11:00 UTC
SELECT cron.schedule(
  'redefinir-prontuarios-diario',
  '0 11 * * *', -- 11:00 UTC = 08:00 BRT
  $$
  SELECT public.redefinir_prontuarios_automatico();
  $$
);