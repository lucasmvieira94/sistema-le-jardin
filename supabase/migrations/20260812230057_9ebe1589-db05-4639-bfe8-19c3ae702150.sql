-- Portal do funcionário usa sessão anônima (PIN); precisa ler os arquivos do bucket privado
-- via URL assinada, como já ocorre com o bucket 'folhas-ponto'.
DROP POLICY IF EXISTS "Anon leitura contracheques storage" ON storage.objects;
CREATE POLICY "Anon leitura contracheques storage"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'contracheques');