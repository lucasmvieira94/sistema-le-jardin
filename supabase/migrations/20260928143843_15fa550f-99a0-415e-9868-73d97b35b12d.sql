-- 1) Unificar duplicados ativos (soma saldos, move histórico)
WITH grupos AS (
  SELECT id, first_value(id) OVER w AS manter,
         sum(quantidade_atual) OVER (PARTITION BY tenant_id, residente_id, tipo_fralda, upper(trim(coalesce(marca,''))), tamanho) AS total
  FROM public.estoque_fraldas WHERE ativo
  WINDOW w AS (PARTITION BY tenant_id, residente_id, tipo_fralda, upper(trim(coalesce(marca,''))), tamanho ORDER BY created_at)
)
UPDATE public.uso_fraldas u SET estoque_fralda_id = g.manter
FROM grupos g WHERE u.estoque_fralda_id = g.id AND g.id <> g.manter;

WITH grupos AS (
  SELECT id, first_value(id) OVER w AS manter,
         sum(quantidade_atual) OVER (PARTITION BY tenant_id, residente_id, tipo_fralda, upper(trim(coalesce(marca,''))), tamanho) AS total
  FROM public.estoque_fraldas WHERE ativo
  WINDOW w AS (PARTITION BY tenant_id, residente_id, tipo_fralda, upper(trim(coalesce(marca,''))), tamanho ORDER BY created_at)
), upd AS (
  UPDATE public.estoque_fraldas e SET quantidade_atual = g.total, updated_at = now()
  FROM grupos g WHERE e.id = g.id AND g.id = g.manter RETURNING e.id
)
UPDATE public.estoque_fraldas e SET ativo = false, quantidade_atual = 0, updated_at = now()
FROM grupos g WHERE e.id = g.id AND g.id <> g.manter;

-- 2) Inativar zerados
UPDATE public.estoque_fraldas SET ativo = false, quantidade_atual = 0, updated_at = now()
WHERE ativo AND quantidade_atual <= 0;

-- 3) Unicidade entre ativos
CREATE UNIQUE INDEX IF NOT EXISTS estoque_fraldas_ativo_unico
ON public.estoque_fraldas (tenant_id, residente_id, tipo_fralda, upper(trim(coalesce(marca,''))), tamanho)
WHERE ativo;

-- 4) Baixa por uso: valida saldo e inativa ao zerar
CREATE OR REPLACE FUNCTION public.atualizar_estoque_fralda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saldo integer;
BEGIN
  SELECT quantidade_atual INTO v_saldo FROM public.estoque_fraldas
  WHERE id = NEW.estoque_fralda_id FOR UPDATE;
  IF v_saldo IS NULL THEN RAISE EXCEPTION 'Estoque de fralda não encontrado'; END IF;
  IF NEW.quantidade_usada > v_saldo THEN
    RAISE EXCEPTION 'Quantidade usada (%) maior que o saldo em estoque (%)', NEW.quantidade_usada, v_saldo;
  END IF;
  UPDATE public.estoque_fraldas
  SET quantidade_atual = GREATEST(v_saldo - NEW.quantidade_usada, 0),
      ativo = (v_saldo - NEW.quantidade_usada) > 0,
      updated_at = now()
  WHERE id = NEW.estoque_fralda_id;
  RETURN NEW;
END; $$;

-- 5) Entrada de estoque: soma ao existente ou cria
CREATE OR REPLACE FUNCTION public.adicionar_estoque_fralda(
  p_tenant_id uuid, p_residente_id uuid, p_tipo_fralda text, p_marca text,
  p_tamanho text, p_quantidade integer, p_observacoes text DEFAULT NULL,
  p_quantidade_minima integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_total integer;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF p_tenant_id IS NULL OR p_tipo_fralda IS NULL OR p_tamanho IS NULL THEN RAISE EXCEPTION 'Dados obrigatórios ausentes'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(concat_ws('|', p_tenant_id, p_residente_id, p_tipo_fralda, upper(trim(coalesce(p_marca,''))), p_tamanho)));
  UPDATE public.estoque_fraldas
  SET quantidade_atual = quantidade_atual + p_quantidade,
      data_ultima_compra = CURRENT_DATE, updated_at = now()
  WHERE ativo AND tenant_id = p_tenant_id
    AND residente_id IS NOT DISTINCT FROM p_residente_id
    AND tipo_fralda = p_tipo_fralda AND tamanho = p_tamanho
    AND upper(trim(coalesce(marca,''))) = upper(trim(coalesce(p_marca,'')))
  RETURNING id, quantidade_atual INTO v_id, v_total;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'quantidade_atual', v_total, 'somado', true);
  END IF;
  INSERT INTO public.estoque_fraldas (tenant_id, residente_id, tipo_fralda, marca, tamanho,
    quantidade_atual, quantidade_minima, observacoes, data_ultima_compra, ativo)
  VALUES (p_tenant_id, p_residente_id, p_tipo_fralda, nullif(trim(p_marca),''), p_tamanho,
    p_quantidade, coalesce(p_quantidade_minima, 100), p_observacoes, CURRENT_DATE, true)
  RETURNING id, quantidade_atual INTO v_id, v_total;
  RETURN jsonb_build_object('id', v_id, 'quantidade_atual', v_total, 'somado', false);
END; $$;

GRANT EXECUTE ON FUNCTION public.adicionar_estoque_fralda(uuid,uuid,text,text,text,integer,text,integer) TO anon, authenticated, service_role;