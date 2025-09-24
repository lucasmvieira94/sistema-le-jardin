-- Criar tabela para conversas WhatsApp
CREATE TABLE IF NOT EXISTS public.conversas_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_whatsapp VARCHAR NOT NULL,
  nome_contato VARCHAR,
  ultima_mensagem TEXT,
  ultima_atividade TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status VARCHAR DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'arquivada')),
  mensagens_nao_lidas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para mensagens das conversas  
CREATE TABLE IF NOT EXISTS public.mensagens_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.conversas_whatsapp(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  tipo VARCHAR DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio', 'documento', 'localizacao')),
  direcao VARCHAR NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
  remetente VARCHAR, -- 'sistema', 'ia', 'usuario', ou nome do funcionário
  whatsapp_message_id VARCHAR,
  status VARCHAR DEFAULT 'enviada' CHECK (status IN ('enviada', 'entregue', 'lida', 'falhou')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para mensagens pré-configuradas
CREATE TABLE IF NOT EXISTS public.mensagens_predefinidas_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR NOT NULL,
  conteudo TEXT NOT NULL,
  categoria VARCHAR DEFAULT 'geral',
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para consultas à IA
CREATE TABLE IF NOT EXISTS public.consultas_ia_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT,
  usuario_id UUID,
  conversa_id UUID REFERENCES public.conversas_whatsapp(id),
  status VARCHAR DEFAULT 'processando' CHECK (status IN ('processando', 'concluida', 'erro')),
  tempo_resposta INTEGER, -- em milissegundos
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_conversas_whatsapp_numero ON public.conversas_whatsapp(numero_whatsapp);
CREATE INDEX IF NOT EXISTS idx_conversas_whatsapp_status ON public.conversas_whatsapp(status);
CREATE INDEX IF NOT EXISTS idx_conversas_whatsapp_ultima_atividade ON public.conversas_whatsapp(ultima_atividade DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_conversa ON public.mensagens_whatsapp(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_created_at ON public.mensagens_whatsapp(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_direcao ON public.mensagens_whatsapp(direcao);

CREATE INDEX IF NOT EXISTS idx_consultas_ia_status ON public.consultas_ia_whatsapp(status);
CREATE INDEX IF NOT EXISTS idx_consultas_ia_created_at ON public.consultas_ia_whatsapp(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.conversas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_predefinidas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_ia_whatsapp ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (permite acesso a usuários autenticados)
CREATE POLICY "Usuários autenticados podem gerenciar conversas" ON public.conversas_whatsapp
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem gerenciar mensagens" ON public.mensagens_whatsapp
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem gerenciar mensagens predefinidas" ON public.mensagens_predefinidas_whatsapp
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem gerenciar consultas à IA" ON public.consultas_ia_whatsapp
  FOR ALL USING (auth.role() = 'authenticated');

-- Inserir algumas mensagens predefinidas de exemplo
INSERT INTO public.mensagens_predefinidas_whatsapp (titulo, conteudo, categoria, ordem) VALUES
('Saudação Inicial', 'Olá! Como posso ajudá-lo hoje?', 'saudacao', 1),
('Confirmar Agendamento', 'Seu agendamento foi confirmado para {{data_hora}}. Caso precise cancelar ou reagendar, entre em contato conosco.', 'agendamento', 2),
('Lembrete Medicação', 'Lembrete: É hora de tomar sua medicação. Não se esqueça!', 'saude', 3),
('Confirmar Recebimento', 'Recebemos sua mensagem e retornaremos em breve. Obrigado pela paciência!', 'atendimento', 4),
('Informações Gerais', 'Para mais informações, entre em contato pelo telefone (11) 9999-9999 ou visite nosso site.', 'informacao', 5);

-- Criar função para atualizar última atividade da conversa
CREATE OR REPLACE FUNCTION public.atualizar_ultima_atividade_conversa()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversas_whatsapp 
  SET ultima_atividade = now(),
      ultima_mensagem = NEW.conteudo,
      updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar automaticamente a última atividade
CREATE TRIGGER trigger_atualizar_ultima_atividade
  AFTER INSERT ON public.mensagens_whatsapp
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_ultima_atividade_conversa();

-- Criar função para atualizar timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers para updated_at
CREATE TRIGGER update_conversas_whatsapp_updated_at
    BEFORE UPDATE ON public.conversas_whatsapp
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_updated_at_column();

CREATE TRIGGER update_mensagens_predefinidas_whatsapp_updated_at
    BEFORE UPDATE ON public.mensagens_predefinidas_whatsapp
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_updated_at_column();