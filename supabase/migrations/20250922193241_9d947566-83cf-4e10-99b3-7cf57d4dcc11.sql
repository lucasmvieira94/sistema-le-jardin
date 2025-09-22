-- Criar tabela para alertas do WhatsApp
CREATE TABLE public.alertas_whatsapp (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    numeros_destino TEXT[] NOT NULL, -- Array de números de WhatsApp
    frequencia_tipo VARCHAR(20) NOT NULL CHECK (frequencia_tipo IN ('horario_especifico', 'horas', 'dias', 'semanas', 'meses')),
    frequencia_valor INTEGER NOT NULL, -- Valor da frequência (ex: a cada 2 horas)
    horario_especifico TIME, -- Para frequencia_tipo = 'horario_especifico'
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ativo BOOLEAN NOT NULL DEFAULT true,
    mensagem_dinamica BOOLEAN DEFAULT false, -- Se deve incluir data/hora atual
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela para agendamentos
CREATE TABLE public.agendamentos_whatsapp (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alerta_id UUID NOT NULL REFERENCES public.alertas_whatsapp(id) ON DELETE CASCADE,
    proxima_execucao TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'executando', 'concluido', 'erro')),
    tentativas INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar tabela para histórico de notificações
CREATE TABLE public.historico_notificacoes_whatsapp (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alerta_id UUID NOT NULL REFERENCES public.alertas_whatsapp(id) ON DELETE CASCADE,
    agendamento_id UUID REFERENCES public.agendamentos_whatsapp(id) ON DELETE SET NULL,
    numero_destino TEXT NOT NULL,
    mensagem_enviada TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('enviado', 'erro', 'pendente')),
    erro_descricao TEXT,
    whatsapp_message_id TEXT, -- ID da mensagem no WhatsApp
    data_envio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tentativa_numero INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.alertas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

-- RLS Policies para alertas_whatsapp
CREATE POLICY "Admins podem gerenciar alertas WhatsApp"
ON public.alertas_whatsapp
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para agendamentos_whatsapp
CREATE POLICY "Admins podem gerenciar agendamentos WhatsApp"
ON public.agendamentos_whatsapp
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para historico_notificacoes_whatsapp
CREATE POLICY "Admins podem gerenciar histórico WhatsApp"
ON public.historico_notificacoes_whatsapp
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices para performance
CREATE INDEX idx_alertas_whatsapp_ativo ON public.alertas_whatsapp(ativo);
CREATE INDEX idx_agendamentos_whatsapp_proxima_execucao ON public.agendamentos_whatsapp(proxima_execucao, status);
CREATE INDEX idx_agendamentos_whatsapp_alerta_id ON public.agendamentos_whatsapp(alerta_id);
CREATE INDEX idx_historico_notificacoes_whatsapp_alerta_id ON public.historico_notificacoes_whatsapp(alerta_id);
CREATE INDEX idx_historico_notificacoes_whatsapp_data_envio ON public.historico_notificacoes_whatsapp(data_envio);

-- Função para calcular próxima execução
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

-- Função para criar agendamento quando um alerta é inserido/atualizado
CREATE OR REPLACE FUNCTION public.criar_agendamento_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Trigger para criar agendamentos automaticamente
CREATE TRIGGER trigger_criar_agendamento_whatsapp
    AFTER INSERT OR UPDATE ON public.alertas_whatsapp
    FOR EACH ROW
    EXECUTE FUNCTION public.criar_agendamento_whatsapp();

-- Função para processar mensagem dinâmica
CREATE OR REPLACE FUNCTION public.processar_mensagem_dinamica(
    p_mensagem TEXT,
    p_timezone VARCHAR DEFAULT 'America/Sao_Paulo'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
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

-- Função para update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_alertas_whatsapp_updated_at 
    BEFORE UPDATE ON public.alertas_whatsapp 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agendamentos_whatsapp_updated_at 
    BEFORE UPDATE ON public.agendamentos_whatsapp 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();