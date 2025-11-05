-- Criar tabela de configurações de alertas por usuário
CREATE TABLE IF NOT EXISTS public.configuracoes_alertas_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_alerta VARCHAR NOT NULL,
  notificar_push BOOLEAN NOT NULL DEFAULT true,
  notificar_email BOOLEAN NOT NULL DEFAULT false,
  notificar_dashboard BOOLEAN NOT NULL DEFAULT true,
  condicoes JSONB,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tipo_alerta)
);

-- Habilitar RLS
ALTER TABLE public.configuracoes_alertas_usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem visualizar suas próprias configurações"
  ON public.configuracoes_alertas_usuarios
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias configurações"
  ON public.configuracoes_alertas_usuarios
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações"
  ON public.configuracoes_alertas_usuarios
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias configurações"
  ON public.configuracoes_alertas_usuarios
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins podem gerenciar todas as configurações
CREATE POLICY "Admins podem gerenciar todas as configurações de alertas"
  ON public.configuracoes_alertas_usuarios
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracoes_alertas_usuarios_updated_at
  BEFORE UPDATE ON public.configuracoes_alertas_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhor performance
CREATE INDEX idx_configuracoes_alertas_user_id ON public.configuracoes_alertas_usuarios(user_id);
CREATE INDEX idx_configuracoes_alertas_tipo ON public.configuracoes_alertas_usuarios(tipo_alerta);