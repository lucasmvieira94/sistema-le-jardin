ALTER TYPE public.documento_tipo ADD VALUE IF NOT EXISTS 'anexo_afastamento';

CREATE TABLE public.afastamentos_anexos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 afastamento_id uuid NOT NULL REFERENCES public.afastamentos(id) ON DELETE CASCADE,
 tenant_id uuid,
 nome_original text NOT NULL,
 formato_original text NOT NULL,
 tamanho_original bigint NOT NULL,
 hash_original text NOT NULL,
 pdf_path text NOT NULL UNIQUE,
 tamanho_pdf bigint NOT NULL,
 hash_pdf text NOT NULL,
 token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 documento_id uuid REFERENCES public.documentos_emitidos(id) ON DELETE SET NULL,
 revogado_em timestamptz,
 criado_por uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.afastamentos_anexos TO authenticated;
GRANT ALL ON public.afastamentos_anexos TO service_role;
ALTER TABLE public.afastamentos_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin consulta anexos da instituicao" ON public.afastamentos_anexos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') AND (tenant_id IS NULL OR tenant_id = public.get_current_tenant_id()));
CREATE POLICY "Admin cria anexos da instituicao" ON public.afastamentos_anexos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND (tenant_id IS NULL OR tenant_id = public.get_current_tenant_id()) AND criado_por = auth.uid());
CREATE POLICY "Admin revoga anexos da instituicao" ON public.afastamentos_anexos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') AND (tenant_id IS NULL OR tenant_id = public.get_current_tenant_id())) WITH CHECK (public.has_role(auth.uid(),'admin') AND (tenant_id IS NULL OR tenant_id = public.get_current_tenant_id()));
CREATE UNIQUE INDEX afastamentos_anexos_ativo_unico ON public.afastamentos_anexos(afastamento_id) WHERE revogado_em IS NULL;
CREATE INDEX afastamentos_anexos_tenant_idx ON public.afastamentos_anexos(tenant_id, afastamento_id);
CREATE OR REPLACE FUNCTION public.atualizar_afastamentos_anexos_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER atualizar_afastamentos_anexos BEFORE UPDATE ON public.afastamentos_anexos FOR EACH ROW EXECUTE FUNCTION public.atualizar_afastamentos_anexos_timestamp();

CREATE TABLE public.afastamentos_anexos_acessos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 anexo_id uuid NOT NULL REFERENCES public.afastamentos_anexos(id) ON DELETE CASCADE,
 ip text,
 user_agent text,
 resultado text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.afastamentos_anexos_acessos TO authenticated;
GRANT ALL ON public.afastamentos_anexos_acessos TO service_role;
ALTER TABLE public.afastamentos_anexos_acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin consulta acessos aos anexos" ON public.afastamentos_anexos_acessos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.afastamentos_anexos a WHERE a.id=anexo_id AND (a.tenant_id IS NULL OR a.tenant_id=public.get_current_tenant_id())));
CREATE OR REPLACE FUNCTION public.atualizar_afastamentos_anexos_acessos_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER atualizar_afastamentos_anexos_acessos BEFORE UPDATE ON public.afastamentos_anexos_acessos FOR EACH ROW EXECUTE FUNCTION public.atualizar_afastamentos_anexos_acessos_timestamp();

CREATE POLICY "Admin envia PDF de afastamento" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='afastamentos-documentos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin consulta PDF de afastamento" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='afastamentos-documentos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove PDF de afastamento" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='afastamentos-documentos' AND public.has_role(auth.uid(),'admin'));
