
ALTER TABLE public.intercorrencias ADD COLUMN IF NOT EXISTS imagens TEXT[] DEFAULT '{}'::text[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('intercorrencias-imagens', 'intercorrencias-imagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read intercorrencias imagens"
ON storage.objects FOR SELECT
USING (bucket_id = 'intercorrencias-imagens');

CREATE POLICY "Anyone can upload intercorrencias imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'intercorrencias-imagens');

CREATE POLICY "Anyone can update intercorrencias imagens"
ON storage.objects FOR UPDATE
USING (bucket_id = 'intercorrencias-imagens');

CREATE POLICY "Anyone can delete intercorrencias imagens"
ON storage.objects FOR DELETE
USING (bucket_id = 'intercorrencias-imagens');
