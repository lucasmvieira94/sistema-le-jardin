CREATE SEQUENCE public.assinatura_verificacao_codigo_seq MINVALUE 10000000 MAXVALUE 99999999 START 10000000 NO CYCLE;
CREATE TABLE public.assinatura_verificacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 codigo_verificador text NOT NULL UNIQUE DEFAULT nextval('public.assinatura_verificacao_codigo_seq')::text,
 origem text NOT NULL,
 referencia_id uuid NOT NULL,
 hash_documento text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(origem, referencia_id)
);
GRANT ALL ON public.assinatura_verificacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.assinatura_verificacao_codigo_seq TO service_role;
ALTER TABLE public.assinatura_verificacoes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.assinatura_verificacoes_acessos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 verificacao_id uuid NOT NULL REFERENCES public.assinatura_verificacoes(id),
 autentico boolean NOT NULL,
 ip_origem text,
 user_agent text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.assinatura_verificacoes_acessos TO service_role;
ALTER TABLE public.assinatura_verificacoes_acessos ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.registrar_verificacao_assinatura() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='assinatura_envelopes' THEN
  INSERT INTO public.assinatura_verificacoes(origem,referencia_id,hash_documento) VALUES ('envelope',NEW.id,upper(NEW.hash_documento)) ON CONFLICT(origem,referencia_id) DO NOTHING;
 ELSIF NEW.status='assinado' THEN
  INSERT INTO public.assinatura_verificacoes(origem,referencia_id,hash_documento) VALUES ('interno',NEW.id,upper(NEW.hash_documento)) ON CONFLICT(origem,referencia_id) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.registrar_verificacao_assinatura() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER registrar_verificacao_envelope AFTER INSERT ON public.assinatura_envelopes FOR EACH ROW EXECUTE FUNCTION public.registrar_verificacao_assinatura();
CREATE TRIGGER registrar_verificacao_interna AFTER INSERT ON public.documentos_internos_assinaturas FOR EACH ROW EXECUTE FUNCTION public.registrar_verificacao_assinatura();
INSERT INTO public.assinatura_verificacoes(origem,referencia_id,hash_documento) SELECT 'envelope',id,upper(hash_documento) FROM public.assinatura_envelopes ON CONFLICT DO NOTHING;
INSERT INTO public.assinatura_verificacoes(origem,referencia_id,hash_documento) SELECT 'interno',id,upper(hash_documento) FROM public.documentos_internos_assinaturas WHERE status='assinado' ON CONFLICT DO NOTHING;