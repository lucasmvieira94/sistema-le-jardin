ALTER TABLE public.documentos_internos ADD COLUMN IF NOT EXISTS arquivo_path text;

CREATE OR REPLACE FUNCTION public.listar_documentos_funcionario(p_funcionario_id uuid)
 RETURNS TABLE(tipo_documento text, referencia_id uuid, titulo text, subtitulo text, conteudo_html text, arquivo_path text, hash_referencia text, criado_em timestamp with time zone, status text, assinado_em timestamp with time zone, motivo_recusa text, hash_assinatura text, hash_documento text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH f AS (SELECT id FROM funcionarios WHERE id = p_funcionario_id AND ativo),
  docs AS (
    SELECT 'advertencia'::text t, a.id,
      CASE a.tipo WHEN 'suspensao' THEN 'Suspensão disciplinar' WHEN 'advertencia_verbal' THEN 'Advertência verbal' ELSE 'Advertência escrita' END titulo,
      'Ocorrência em ' || to_char(a.data_ocorrencia::date,'DD/MM/YYYY') sub,
      format('<p><b>Motivo:</b> %s</p><p><b>Descrição:</b> %s</p>%s%s',
        a.motivo, a.descricao,
        CASE WHEN a.dias_suspensao IS NOT NULL THEN format('<p><b>Suspensão:</b> %s dia(s), de %s a %s.</p>', a.dias_suspensao, to_char(a.data_inicio_suspensao::date,'DD/MM/YYYY'), to_char(a.data_fim_suspensao::date,'DD/MM/YYYY')) ELSE '' END,
        CASE WHEN a.observacoes IS NOT NULL THEN format('<p><b>Observações:</b> %s</p>', a.observacoes) ELSE '' END) html,
      NULL::text path, a.hash_verificacao h, a.created_at c
    FROM advertencias_suspensoes a JOIN f ON f.id = a.funcionario_id
    UNION ALL
    SELECT 'folha_ponto', fp.id, 'Folha de ponto ' || lpad(fp.mes::text,2,'0') || '/' || fp.ano, 'Espelho mensal de ponto', NULL, fp.path, NULL, fp.created_at
    FROM folhas_ponto fp JOIN f ON f.id = fp.funcionario_id
    UNION ALL
    SELECT 'contracheque', c.id, 'Contracheque ' || lpad(c.mes::text,2,'0') || '/' || c.ano, 'Recibo de pagamento de salário', NULL, c.path, NULL, c.created_at
    FROM contracheques c JOIN f ON f.id = c.funcionario_id
    UNION ALL
    SELECT 'comunicado', d.id, d.titulo,
      CASE d.tipo WHEN 'regimento' THEN 'Regimento interno' WHEN 'politica' THEN 'Política interna' ELSE 'Comunicado' END,
      d.conteudo_html, d.arquivo_path, d.hash_documento, d.created_at
    FROM documentos_internos d, f
    WHERE d.ativo AND (d.funcionario_ids IS NULL OR f.id = ANY(d.funcionario_ids))
  )
  SELECT d.t, d.id, d.titulo, d.sub, d.html, d.path, d.h, d.c,
    COALESCE(s.status, 'pendente'), s.assinado_em, s.motivo_recusa, s.hash_assinatura, s.hash_documento
  FROM docs d
  LEFT JOIN documentos_internos_assinaturas s
    ON s.funcionario_id = p_funcionario_id AND s.tipo_documento = d.t AND s.referencia_id = d.id
  ORDER BY (s.status IS NULL) DESC, d.c DESC
$function$;

CREATE POLICY "Admins enviam documentos-internos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-internos' AND (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())));
CREATE POLICY "Admins apagam documentos-internos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-internos' AND (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())));
CREATE POLICY "Leitura documentos-internos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'documentos-internos');