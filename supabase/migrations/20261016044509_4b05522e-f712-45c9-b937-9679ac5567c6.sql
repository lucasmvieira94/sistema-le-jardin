CREATE OR REPLACE FUNCTION public.eh_gestor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin'))
$$;
REVOKE ALL ON FUNCTION public.eh_gestor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_gestor(uuid) TO authenticated, service_role;

ALTER FUNCTION public.atualizar_ultima_atividade_conversa() SET search_path = public;
ALTER FUNCTION public.redefinir_status_prontuarios_diarios() SET search_path = public;
ALTER FUNCTION public.update_whatsapp_updated_at_column() SET search_path = public;

-- Leitura/gestão por "qualquer logado" passa a exigir gestor (admin/super_admin)
DROP POLICY IF EXISTS "Autenticados leem cargos" ON public.cargos;
CREATE POLICY "Gestores leem cargos" ON public.cargos FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Funcionarios visualizam fichas acolhimento" ON public.fichas_acolhimento;
CREATE POLICY "Gestores visualizam fichas acolhimento" ON public.fichas_acolhimento FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "authenticated_manage_justificativa" ON public.justificativas_atraso;
CREATE POLICY "Gestores gerenciam justificativas" ON public.justificativas_atraso FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated gerencia contracheques" ON public.contracheques;
CREATE POLICY "Gestores gerenciam contracheques" ON public.contracheques FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "authenticated_can_read_funcionarios" ON public.funcionarios;
CREATE POLICY "Gestores leem funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Leitura de logs por autenticados" ON public.biometria_validacoes_log;
CREATE POLICY "Gestores leem logs biometria" ON public.biometria_validacoes_log FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated visualiza lancamentos" ON public.lancamentos_financeiros;
CREATE POLICY "Gestores visualizam lancamentos" ON public.lancamentos_financeiros FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated visualiza mensalidades" ON public.mensalidades_residentes;
CREATE POLICY "Gestores visualizam mensalidades" ON public.mensalidades_residentes FOR SELECT TO authenticated USING (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated gerencia contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Authenticated visualiza contas_pagar" ON public.contas_pagar;
CREATE POLICY "Gestores gerenciam contas_pagar" ON public.contas_pagar FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated gerencia folhas_ponto" ON public.folhas_ponto;
CREATE POLICY "Gestores gerenciam folhas_ponto" ON public.folhas_ponto FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Authenticated full access feedback" ON public.feedback_sistema;
CREATE POLICY "Gestores gerenciam feedback" ON public.feedback_sistema FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar consultas à IA" ON public.consultas_ia_whatsapp;
CREATE POLICY "Gestores gerenciam consultas IA" ON public.consultas_ia_whatsapp FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar conversas" ON public.conversas_whatsapp;
CREATE POLICY "Gestores gerenciam conversas" ON public.conversas_whatsapp FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar mensagens predefinidas" ON public.mensagens_predefinidas_whatsapp;
CREATE POLICY "Gestores gerenciam mensagens predefinidas" ON public.mensagens_predefinidas_whatsapp FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar mensagens" ON public.mensagens_whatsapp;
CREATE POLICY "Gestores gerenciam mensagens" ON public.mensagens_whatsapp FOR ALL TO authenticated USING (public.eh_gestor(auth.uid())) WITH CHECK (public.eh_gestor(auth.uid()));

-- Arquivos
DROP POLICY IF EXISTS "Auth gerencia contracheques storage select" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia contracheques storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia contracheques storage update" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia contracheques storage delete" ON storage.objects;
CREATE POLICY "Gestores gerenciam contracheques storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'contracheques' AND public.eh_gestor(auth.uid())) WITH CHECK (bucket_id = 'contracheques' AND public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Auth gerencia folhas-ponto storage select" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia folhas-ponto storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia folhas-ponto storage update" ON storage.objects;
DROP POLICY IF EXISTS "Auth gerencia folhas-ponto storage delete" ON storage.objects;
CREATE POLICY "Gestores gerenciam folhas-ponto storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'folhas-ponto' AND public.eh_gestor(auth.uid())) WITH CHECK (bucket_id = 'folhas-ponto' AND public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Auth can view comprovantes pagamento" ON storage.objects;
DROP POLICY IF EXISTS "Auth can upload comprovantes pagamento" ON storage.objects;
DROP POLICY IF EXISTS "Auth can update comprovantes pagamento" ON storage.objects;
DROP POLICY IF EXISTS "Auth can delete comprovantes pagamento" ON storage.objects;
CREATE POLICY "Gestores gerenciam comprovantes pagamento" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'comprovantes-pagamento' AND public.eh_gestor(auth.uid())) WITH CHECK (bucket_id = 'comprovantes-pagamento' AND public.eh_gestor(auth.uid()));

DROP POLICY IF EXISTS "Anyone can update intercorrencias imagens" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete intercorrencias imagens" ON storage.objects;
CREATE POLICY "Gestores alteram intercorrencias imagens" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'intercorrencias-imagens' AND public.eh_gestor(auth.uid()));
CREATE POLICY "Gestores excluem intercorrencias imagens" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'intercorrencias-imagens' AND public.eh_gestor(auth.uid()));