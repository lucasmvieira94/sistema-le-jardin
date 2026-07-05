
CREATE POLICY "Auth can view comprovantes pagamento"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes-pagamento');

CREATE POLICY "Auth can upload comprovantes pagamento"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes-pagamento');

CREATE POLICY "Auth can update comprovantes pagamento"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'comprovantes-pagamento');

CREATE POLICY "Auth can delete comprovantes pagamento"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes-pagamento');
