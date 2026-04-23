
-- =============================================================================
-- Tabela de alertas de uso (evita reenvio no mesmo mês)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_uso_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recurso text NOT NULL,                 -- 'funcionarios' | 'residentes' | 'usuarios_admin'
  percentual_atingido numeric NOT NULL,  -- ex: 80, 90, 100
  data_referencia date NOT NULL,         -- primeiro dia do mês
  enviado_em timestamptz NOT NULL DEFAULT now(),
  email_destinatario text,
  status text NOT NULL DEFAULT 'enviado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recurso, percentual_atingido, data_referencia)
);

ALTER TABLE public.tenant_uso_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins gerenciam alertas de uso"
  ON public.tenant_uso_alertas FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Tenant vê próprios alertas"
  ON public.tenant_uso_alertas FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_tenant_uso_alertas_tenant_data
  ON public.tenant_uso_alertas (tenant_id, data_referencia DESC);

-- =============================================================================
-- Função utilitária: garante snapshot do mês para o tenant
-- =============================================================================
CREATE OR REPLACE FUNCTION public.garantir_tenant_uso_mes(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data_ref date := date_trunc('month', now())::date;
  _id uuid;
BEGIN
  IF _tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _id FROM public.tenant_uso
  WHERE tenant_id = _tenant_id AND data_referencia = _data_ref;

  IF _id IS NULL THEN
    INSERT INTO public.tenant_uso (tenant_id, data_referencia)
    VALUES (_tenant_id, _data_ref)
    RETURNING id INTO _id;
  END IF;

  RETURN _id;
END;
$$;

-- =============================================================================
-- Função genérica que atualiza um contador específico
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recalcular_tenant_uso_contador(
  _tenant_id uuid,
  _coluna text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data_ref date := date_trunc('month', now())::date;
  _inicio_mes timestamptz := date_trunc('month', now());
  _valor bigint := 0;
BEGIN
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.garantir_tenant_uso_mes(_tenant_id);

  IF _coluna = 'funcionarios_ativos' THEN
    SELECT count(*) INTO _valor FROM public.funcionarios
      WHERE tenant_id = _tenant_id AND ativo = true;
  ELSIF _coluna = 'residentes_ativos' THEN
    SELECT count(*) INTO _valor FROM public.residentes
      WHERE tenant_id = _tenant_id AND ativo = true;
  ELSIF _coluna = 'usuarios_admin' THEN
    SELECT count(*) INTO _valor FROM public.user_roles
      WHERE tenant_id = _tenant_id AND role = 'admin';
  ELSIF _coluna = 'registros_ponto_mes' THEN
    SELECT count(*) INTO _valor FROM public.registros_ponto
      WHERE tenant_id = _tenant_id AND created_at >= _inicio_mes;
  ELSIF _coluna = 'consultas_ia_mes' THEN
    SELECT count(*) INTO _valor FROM public.consultas_ia_whatsapp
      WHERE tenant_id = _tenant_id AND created_at >= _inicio_mes;
  ELSE
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE public.tenant_uso SET %I = $1, atualizado_em = now() WHERE tenant_id = $2 AND data_referencia = $3',
    _coluna
  ) USING _valor, _tenant_id, _data_ref;
END;
$$;

-- =============================================================================
-- Triggers por tabela
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_uso_funcionarios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_tenant_uso_contador(COALESCE(NEW.tenant_id, OLD.tenant_id), 'funcionarios_ativos');
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_funcionarios ON public.funcionarios;
CREATE TRIGGER trg_uso_funcionarios
AFTER INSERT OR UPDATE OF ativo, tenant_id OR DELETE ON public.funcionarios
FOR EACH ROW EXECUTE FUNCTION public.trg_uso_funcionarios();

CREATE OR REPLACE FUNCTION public.trg_uso_residentes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_tenant_uso_contador(COALESCE(NEW.tenant_id, OLD.tenant_id), 'residentes_ativos');
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_residentes ON public.residentes;
CREATE TRIGGER trg_uso_residentes
AFTER INSERT OR UPDATE OF ativo, tenant_id OR DELETE ON public.residentes
FOR EACH ROW EXECUTE FUNCTION public.trg_uso_residentes();

CREATE OR REPLACE FUNCTION public.trg_uso_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_tenant_uso_contador(COALESCE(NEW.tenant_id, OLD.tenant_id), 'usuarios_admin');
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_user_roles ON public.user_roles;
CREATE TRIGGER trg_uso_user_roles
AFTER INSERT OR UPDATE OF role, tenant_id OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.trg_uso_user_roles();

CREATE OR REPLACE FUNCTION public.trg_uso_registros_ponto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_tenant_uso_contador(COALESCE(NEW.tenant_id, OLD.tenant_id), 'registros_ponto_mes');
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_registros_ponto ON public.registros_ponto;
CREATE TRIGGER trg_uso_registros_ponto
AFTER INSERT OR DELETE ON public.registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.trg_uso_registros_ponto();

CREATE OR REPLACE FUNCTION public.trg_uso_consultas_ia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_tenant_uso_contador(COALESCE(NEW.tenant_id, OLD.tenant_id), 'consultas_ia_mes');
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_uso_consultas_ia ON public.consultas_ia_whatsapp;
CREATE TRIGGER trg_uso_consultas_ia
AFTER INSERT OR DELETE ON public.consultas_ia_whatsapp
FOR EACH ROW EXECUTE FUNCTION public.trg_uso_consultas_ia();
