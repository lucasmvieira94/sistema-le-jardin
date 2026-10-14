ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance';

CREATE TABLE public.denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  protocolo text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  anonima boolean NOT NULL DEFAULT true,
  categoria text NOT NULL,
  ainda_ocorre boolean,
  situacao text NOT NULL DEFAULT 'recebida',
  conclusao text,
  probabilidade smallint,
  severidade smallint,
  prazo_resposta date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 30),
  dados_cifrados text NOT NULL,
  medidas_cifradas text,
  tentativas_falhas int NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.denuncias_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  autor text NOT NULL CHECK (autor IN ('denunciante','comite','interna')),
  conteudo_cifrado text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.denuncias_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  path text NOT NULL,
  nome_cifrado text NOT NULL,
  mime text NOT NULL,
  tamanho int NOT NULL,
  sha256 text NOT NULL,
  enviado_por text NOT NULL DEFAULT 'denunciante',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.denuncias_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid REFERENCES public.denuncias(id) ON DELETE SET NULL,
  protocolo text,
  usuario_id uuid,
  usuario_nome text,
  acao text NOT NULL,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.denuncias, public.denuncias_mensagens, public.denuncias_anexos, public.denuncias_auditoria TO service_role;
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente servidor" ON public.denuncias FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Somente servidor" ON public.denuncias_mensagens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Somente servidor" ON public.denuncias_anexos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Somente servidor" ON public.denuncias_auditoria FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.denuncias_auditoria_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Trilha de auditoria do canal de denúncias é imutável'; END $$;
CREATE TRIGGER trg_denuncias_auditoria_imutavel BEFORE UPDATE OR DELETE ON public.denuncias_auditoria
FOR EACH ROW EXECUTE FUNCTION public.denuncias_auditoria_imutavel();

CREATE OR REPLACE FUNCTION public.denuncias_set_updated() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_denuncias_updated BEFORE UPDATE ON public.denuncias FOR EACH ROW EXECUTE FUNCTION public.denuncias_set_updated();

CREATE OR REPLACE FUNCTION public.limitar_compliance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role::text = 'compliance' AND
     (SELECT count(*) FROM public.user_roles WHERE role::text = 'compliance' AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id AND user_id <> NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'Máximo de 2 pessoas no comitê de compliance';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_limitar_compliance BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.limitar_compliance();

CREATE INDEX idx_denuncias_created ON public.denuncias(created_at DESC);
CREATE INDEX idx_denuncias_aud ON public.denuncias_auditoria(denuncia_id, created_at DESC);