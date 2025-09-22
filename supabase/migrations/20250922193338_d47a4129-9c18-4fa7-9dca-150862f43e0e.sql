-- Corrigir warnings de segurança das funções criadas - adicionar search_path

-- Função para calcular próxima execução (com search_path seguro)
CREATE OR REPLACE FUNCTION public.calcular_proxima_execucao(
    p_frequencia_tipo VARCHAR,
    p_frequencia_valor INTEGER,
    p_horario_especifico TIME,
    p_data_base TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_timezone VARCHAR DEFAULT 'America/Sao_Paulo'
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    proxima_execucao TIMESTAMP WITH TIME ZONE;
    data_base_tz TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Converter para timezone especificado
    data_base_tz := p_data_base AT TIME ZONE p_timezone;
    
    CASE p_frequencia_tipo
        WHEN 'horario_especifico' THEN
            -- Próximo horário específico (hoje ou amanhã)
            proxima_execucao := DATE_TRUNC('day', data_base_tz) + p_horario_especifico;
            IF proxima_execucao <= data_base_tz THEN
                proxima_execucao := proxima_execucao + INTERVAL '1 day';
            END IF;
            
        WHEN 'horas' THEN
            proxima_execucao := data_base_tz + (p_frequencia_valor || ' hours')::INTERVAL;
            
        WHEN 'dias' THEN
            proxima_execucao := data_base_tz + (p_frequencia_valor || ' days')::INTERVAL;
            
        WHEN 'semanas' THEN
            proxima_execucao := data_base_tz + (p_frequencia_valor || ' weeks')::INTERVAL;
            
        WHEN 'meses' THEN
            proxima_execucao := data_base_tz + (p_frequencia_valor || ' months')::INTERVAL;
            
        ELSE
            RAISE EXCEPTION 'Frequência inválida: %', p_frequencia_tipo;
    END CASE;
    
    RETURN proxima_execucao;
END;
$$;

-- Função para criar agendamento (com search_path seguro)
CREATE OR REPLACE FUNCTION public.criar_agendamento_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    proxima_exec TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Só criar agendamento se o alerta está ativo
    IF NEW.ativo THEN
        -- Calcular próxima execução
        proxima_exec := public.calcular_proxima_execucao(
            NEW.frequencia_tipo,
            NEW.frequencia_valor,
            NEW.horario_especifico,
            GREATEST(NEW.data_inicio, NOW()),
            NEW.timezone
        );
        
        -- Inserir ou atualizar agendamento
        INSERT INTO public.agendamentos_whatsapp (alerta_id, proxima_execucao, status)
        VALUES (NEW.id, proxima_exec, 'agendado')
        ON CONFLICT (alerta_id) DO UPDATE SET
            proxima_execucao = EXCLUDED.proxima_execucao,
            status = 'agendado',
            tentativas = 0,
            updated_at = NOW();
    ELSE
        -- Se alerta foi desativado, remover agendamentos pendentes
        DELETE FROM public.agendamentos_whatsapp 
        WHERE alerta_id = NEW.id AND status = 'agendado';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Função para processar mensagem dinâmica (com search_path seguro)
CREATE OR REPLACE FUNCTION public.processar_mensagem_dinamica(
    p_mensagem TEXT,
    p_timezone VARCHAR DEFAULT 'America/Sao_Paulo'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mensagem_processada TEXT;
    data_atual TIMESTAMP WITH TIME ZONE;
BEGIN
    data_atual := NOW() AT TIME ZONE p_timezone;
    
    mensagem_processada := p_mensagem;
    
    -- Substituir variáveis dinâmicas
    mensagem_processada := REPLACE(mensagem_processada, '{{data_atual}}', TO_CHAR(data_atual, 'DD/MM/YYYY'));
    mensagem_processada := REPLACE(mensagem_processada, '{{hora_atual}}', TO_CHAR(data_atual, 'HH24:MI'));
    mensagem_processada := REPLACE(mensagem_processada, '{{data_hora_atual}}', TO_CHAR(data_atual, 'DD/MM/YYYY HH24:MI'));
    mensagem_processada := REPLACE(mensagem_processada, '{{dia_semana}}', TO_CHAR(data_atual, 'Day'));
    
    RETURN mensagem_processada;
END;
$$;

-- Atualizar função update_updated_at_column com search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;