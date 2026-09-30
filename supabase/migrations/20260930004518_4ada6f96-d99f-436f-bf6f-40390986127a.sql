CREATE TABLE public.dashboard_preferencias (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  ordem text[] NOT NULL DEFAULT '{}',
  ocultos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_preferencias TO authenticated;
GRANT ALL ON public.dashboard_preferencias TO service_role;
ALTER TABLE public.dashboard_preferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário gerencia suas preferências" ON public.dashboard_preferencias
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.uso_sistema_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid DEFAULT public.get_current_tenant_id(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL CHECK (tipo IN ('pagina','quadro_visto','quadro_clique')),
  alvo text NOT NULL CHECK (length(alvo) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uso_eventos_tenant_data ON public.uso_sistema_eventos (tenant_id, created_at);
GRANT SELECT, INSERT ON public.uso_sistema_eventos TO authenticated;
GRANT ALL ON public.uso_sistema_eventos TO service_role;
ALTER TABLE public.uso_sistema_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário registra o próprio uso" ON public.uso_sistema_eventos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin consulta uso da empresa" ON public.uso_sistema_eventos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') AND tenant_id IS NOT DISTINCT FROM public.get_current_tenant_id());

CREATE TABLE public.dashboard_sugestoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('adicionar','remover','reordenar')),
  quadro text NOT NULL,
  posicao int,
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aplicada','dispensada')),
  decidido_por uuid,
  decidido_em timestamptz,
  analisado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sugestoes_tenant_status ON public.dashboard_sugestoes_ia (tenant_id, status);
GRANT SELECT, UPDATE ON public.dashboard_sugestoes_ia TO authenticated;
GRANT ALL ON public.dashboard_sugestoes_ia TO service_role;
ALTER TABLE public.dashboard_sugestoes_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin vê sugestões da empresa" ON public.dashboard_sugestoes_ia
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') AND tenant_id IS NOT DISTINCT FROM public.get_current_tenant_id());
CREATE POLICY "Admin decide sugestões da empresa" ON public.dashboard_sugestoes_ia
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND tenant_id IS NOT DISTINCT FROM public.get_current_tenant_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND tenant_id IS NOT DISTINCT FROM public.get_current_tenant_id());

CREATE TABLE public.consultor_painel_execucoes (
  chave text PRIMARY KEY,
  trava_ate timestamptz,
  pausado_motivo text,
  ultima_execucao timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.consultor_painel_execucoes TO service_role;
ALTER TABLE public.consultor_painel_execucoes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_dash_pref_updated BEFORE UPDATE ON public.dashboard_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_sug_updated BEFORE UPDATE ON public.dashboard_sugestoes_ia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Retenção de 90 dias dos eventos de uso
CREATE OR REPLACE FUNCTION public.limpar_uso_sistema_antigo()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.uso_sistema_eventos WHERE created_at < now() - interval '90 days';
$$;
REVOKE EXECUTE ON FUNCTION public.limpar_uso_sistema_antigo() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('limpar-uso-sistema', '0 4 * * *', 'SELECT public.limpar_uso_sistema_antigo()');