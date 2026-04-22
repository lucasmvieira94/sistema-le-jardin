
-- =====================================================================
-- FUNÇÕES AUXILIARES
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- =====================================================================
-- CATÁLOGO COMERCIAL
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  descricao text,
  preco_mensal numeric(10,2) NOT NULL DEFAULT 0,
  preco_anual numeric(10,2) NOT NULL DEFAULT 0,
  limite_funcionarios integer NOT NULL DEFAULT 10,
  limite_residentes integer NOT NULL DEFAULT 20,
  limite_usuarios_admin integer NOT NULL DEFAULT 2,
  modulos_inclusos text[] NOT NULL DEFAULT ARRAY['ponto','escala','prontuario']::text[],
  ordem integer NOT NULL DEFAULT 0,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos visualizam planos ativos" ON public.planos FOR SELECT USING (ativo = true);
CREATE POLICY "Super admins gerenciam planos" ON public.planos FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','ativa','inadimplente','suspensa','cancelada')),
  ciclo text NOT NULL DEFAULT 'mensal' CHECK (ciclo IN ('mensal','anual')),
  valor_contratado numeric(10,2) NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim_trial date,
  proxima_cobranca date,
  data_cancelamento timestamptz,
  motivo_cancelamento text,
  observacoes_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins gerenciam assinaturas" ON public.assinaturas FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Tenant vê própria assinatura" ON public.assinaturas FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE TABLE IF NOT EXISTS public.faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero text NOT NULL UNIQUE,
  valor numeric(10,2) NOT NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','vencida','cancelada')),
  metodo_pagamento text,
  link_pagamento text,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins gerenciam faturas" ON public.faturas FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Tenant vê próprias faturas" ON public.faturas FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE TABLE IF NOT EXISTS public.tenant_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  habilitado boolean NOT NULL DEFAULT true,
  habilitado_em timestamptz NOT NULL DEFAULT now(),
  habilitado_por uuid,
  observacoes text,
  UNIQUE(tenant_id, modulo)
);
ALTER TABLE public.tenant_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins gerenciam módulos" ON public.tenant_modulos FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Tenant vê próprios módulos" ON public.tenant_modulos FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());
CREATE POLICY "Anon lê módulos" ON public.tenant_modulos FOR SELECT TO anon USING (true);

CREATE TABLE IF NOT EXISTS public.tenant_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  funcionarios_ativos integer NOT NULL DEFAULT 0,
  residentes_ativos integer NOT NULL DEFAULT 0,
  usuarios_admin integer NOT NULL DEFAULT 0,
  registros_ponto_mes integer NOT NULL DEFAULT 0,
  consultas_ia_mes integer NOT NULL DEFAULT 0,
  mensagens_whatsapp_mes integer NOT NULL DEFAULT 0,
  storage_mb numeric(10,2) NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, data_referencia)
);
ALTER TABLE public.tenant_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins veem todo uso" ON public.tenant_uso FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Tenant vê próprio uso" ON public.tenant_uso FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

-- Triggers updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS planos_updated_at ON public.planos;
CREATE TRIGGER planos_updated_at BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER assinaturas_updated_at BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS faturas_updated_at ON public.faturas;
CREATE TRIGGER faturas_updated_at BEFORE UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed planos
INSERT INTO public.planos (nome, slug, descricao, preco_mensal, preco_anual, limite_funcionarios, limite_residentes, limite_usuarios_admin, modulos_inclusos, ordem, destaque)
VALUES
  ('Starter', 'starter', 'Para pequenas residências começarem a digitalizar.', 297.00, 2970.00, 15, 25, 1,
    ARRAY['ponto','escala','prontuario','residentes'], 1, false),
  ('Profissional', 'profissional', 'Para residenciais consolidados que precisam de tudo.', 597.00, 5970.00, 40, 60, 3,
    ARRAY['ponto','escala','prontuario','residentes','medicamentos','fraldas','intercorrencias','advertencias','vacinas','contratos','temperatura'], 2, true),
  ('Enterprise', 'enterprise', 'Para redes com múltiplas unidades e necessidades avançadas.', 1297.00, 12970.00, 999, 999, 10,
    ARRAY['ponto','escala','prontuario','residentes','medicamentos','fraldas','intercorrencias','advertencias','vacinas','contratos','temperatura','gamificacao','whatsapp','ia','relatorios_ia'], 3, false)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- HARDENING: tenant_id em tabelas legadas
-- =====================================================================
DO $$
DECLARE
  default_tenant_id uuid;
  tbl text;
  tables_to_patch text[] := ARRAY[
    'funcionarios','residentes','escalas','registros_ponto',
    'prontuario_ciclos','prontuario_registros','prontuario_templates_obrigatorios',
    'medicamentos','estoque_medicamentos','administracao_medicamentos',
    'prescricoes_medicamentos','entrada_medicamentos','residentes_medicamentos',
    'contratos_residentes','controle_temperatura_medicamentos',
    'advertencias_suspensoes','afastamentos','intercorrencias','intercorrencias_logs',
    'feedback_sistema','configuracoes_empresa','configuracoes_prontuario',
    'configuracoes_alertas_usuarios','tipos_afastamento','catalogo_vacinas',
    'vacinas_residentes','solicitacoes_contrato_temporario',
    'gamification_profiles','gamification_resgates','gamification_rewards',
    'gamification_transactions','atividades_templates','formulario_campos_config',
    'alertas_whatsapp','agendamentos_whatsapp','consultas_ia_whatsapp',
    'conversas_whatsapp','mensagens_whatsapp','mensagens_predefinidas_whatsapp',
    'historico_notificacoes_whatsapp','lembretes_funcionario',
    'push_subscriptions_funcionario','registro_tentativas','convites','audit_log'
  ];
BEGIN
  SELECT id INTO default_tenant_id FROM public.tenants WHERE ativo = true ORDER BY created_at LIMIT 1;
  IF default_tenant_id IS NULL THEN RETURN; END IF;

  FOREACH tbl IN ARRAY tables_to_patch LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name=tbl AND column_name='tenant_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE', tbl);
      EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', tbl, default_tenant_id);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id)', tbl, tbl);
    END IF;
  END LOOP;
END$$;

-- =====================================================================
-- PROVISIONAMENTO AUTOMÁTICO DE NOVO TENANT
-- =====================================================================
CREATE OR REPLACE FUNCTION public.provisionar_novo_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  starter_plan_id uuid;
  modulo text;
BEGIN
  FOREACH modulo IN ARRAY ARRAY['ponto','escala','prontuario','residentes'] LOOP
    INSERT INTO public.tenant_modulos (tenant_id, modulo, habilitado)
    VALUES (NEW.id, modulo, true) ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO starter_plan_id FROM public.planos WHERE slug = 'starter' LIMIT 1;
  IF starter_plan_id IS NOT NULL THEN
    INSERT INTO public.assinaturas (tenant_id, plano_id, status, data_fim_trial, valor_contratado)
    VALUES (NEW.id, starter_plan_id, 'trial', CURRENT_DATE + INTERVAL '14 days', 0)
    ON CONFLICT (tenant_id) DO NOTHING;
  END IF;

  INSERT INTO public.tenant_uso (tenant_id, data_referencia)
  VALUES (NEW.id, CURRENT_DATE) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_provisionar_tenant ON public.tenants;
CREATE TRIGGER trigger_provisionar_tenant AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.provisionar_novo_tenant();

-- Provisionar tenant existente (Le Jardin) como Enterprise ativo
DO $$
DECLARE
  existing_tenant_id uuid;
  ent_plan_id uuid;
  modulo text;
BEGIN
  SELECT id INTO existing_tenant_id FROM public.tenants WHERE ativo = true ORDER BY created_at LIMIT 1;
  SELECT id INTO ent_plan_id FROM public.planos WHERE slug = 'enterprise' LIMIT 1;

  IF existing_tenant_id IS NOT NULL THEN
    FOREACH modulo IN ARRAY ARRAY['ponto','escala','prontuario','residentes','medicamentos','fraldas','intercorrencias','advertencias','vacinas','contratos','temperatura','gamificacao','whatsapp','ia','relatorios_ia'] LOOP
      INSERT INTO public.tenant_modulos (tenant_id, modulo, habilitado)
      VALUES (existing_tenant_id, modulo, true) ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO public.assinaturas (tenant_id, plano_id, status, ciclo, valor_contratado, observacoes_admin)
    VALUES (existing_tenant_id, ent_plan_id, 'ativa', 'mensal', 1297.00, 'Cliente fundador — Le Jardin Residencial Senior')
    ON CONFLICT (tenant_id) DO NOTHING;

    INSERT INTO public.tenant_uso (tenant_id, data_referencia)
    VALUES (existing_tenant_id, CURRENT_DATE) ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_assinaturas_tenant ON public.assinaturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON public.assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_faturas_tenant ON public.faturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas(status);
CREATE INDEX IF NOT EXISTS idx_faturas_vencimento ON public.faturas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tenant_modulos_tenant ON public.tenant_modulos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_uso_tenant ON public.tenant_uso(tenant_id, data_referencia DESC);
