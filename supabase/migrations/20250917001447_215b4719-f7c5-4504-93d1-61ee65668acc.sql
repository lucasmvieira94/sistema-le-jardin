-- Criar tabela para gerenciar convites
CREATE TABLE public.convites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'employee'::app_role,
  token text NOT NULL UNIQUE,
  status character varying NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'expirado', 'revogado')),
  enviado_por uuid REFERENCES auth.users(id) NOT NULL,
  data_envio timestamp with time zone NOT NULL DEFAULT now(),
  data_expiracao timestamp with time zone NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  data_aceite timestamp with time zone,
  aceito_por uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins podem gerenciar todos os convites" 
ON public.convites 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver convites pelo token" 
ON public.convites 
FOR SELECT 
USING (true); -- Permite ver convites pelo token público

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_convites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_convites_updated_at
BEFORE UPDATE ON public.convites
FOR EACH ROW
EXECUTE FUNCTION update_convites_updated_at();

-- Função para gerar token único
CREATE OR REPLACE FUNCTION gerar_token_convite()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_token text;
  token_existe boolean;
BEGIN
  LOOP
    -- Gerar token aleatório de 32 caracteres
    novo_token := encode(gen_random_bytes(24), 'base64');
    novo_token := replace(novo_token, '/', '_');
    novo_token := replace(novo_token, '+', '-');
    
    -- Verificar se o token já existe
    SELECT EXISTS(SELECT 1 FROM convites WHERE token = novo_token) INTO token_existe;
    
    -- Se não existe, sair do loop
    IF NOT token_existe THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN novo_token;
END;
$$;