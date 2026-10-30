CREATE TABLE public.assinatura_pdfs_finais (
 envelope_id uuid PRIMARY KEY REFERENCES public.assinatura_envelopes(id) ON DELETE CASCADE,
 arquivo_path text NOT NULL, hash_pdf text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assinatura_pdfs_finais TO authenticated;
GRANT ALL ON public.assinatura_pdfs_finais TO service_role;
ALTER TABLE public.assinatura_pdfs_finais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores consultam via final autorizada" ON public.assinatura_pdfs_finais FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()) AND EXISTS (SELECT 1 FROM public.assinatura_envelopes e WHERE e.id=envelope_id AND (e.tenant_id IS NULL OR public.has_tenant_access(e.tenant_id))));
CREATE TRIGGER assinatura_pdfs_updated BEFORE UPDATE ON public.assinatura_pdfs_finais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Downloads are mediated by the authenticated/token-validated function; no public storage policies.
