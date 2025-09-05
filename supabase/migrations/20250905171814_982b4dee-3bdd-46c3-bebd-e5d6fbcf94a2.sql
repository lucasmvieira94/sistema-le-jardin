-- Criar bucket para logotipos da empresa
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos', 
  'company-logos', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp']
);

-- Políticas para o bucket de logotipos
CREATE POLICY "Admins podem gerenciar logotipos da empresa"
ON storage.objects
FOR ALL
USING (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Todos podem visualizar logotipos da empresa"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');

-- Adicionar campo logo_url na tabela configuracoes_empresa
ALTER TABLE public.configuracoes_empresa 
ADD COLUMN IF NOT EXISTS logo_url text;