-- Corrigir funções para definir search_path adequadamente
CREATE OR REPLACE FUNCTION public.update_medicamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.atualizar_estoque_medicamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualizar se foi realmente administrado e tem referência ao estoque
  IF NEW.status = 'administrado' AND NEW.estoque_medicamento_id IS NOT NULL THEN
    UPDATE public.estoque_medicamentos
    SET quantidade_atual = quantidade_atual - NEW.quantidade_utilizada,
        updated_at = now()
    WHERE id = NEW.estoque_medicamento_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.estoque_medicamentos
  SET quantidade_atual = quantidade_atual + NEW.quantidade,
      updated_at = now()
  WHERE id = NEW.estoque_medicamento_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Função para obter medicamentos com estoque baixo
CREATE OR REPLACE FUNCTION public.obter_medicamentos_estoque_baixo()
RETURNS TABLE(
  medicamento_nome text,
  quantidade_atual numeric,
  quantidade_minima numeric,
  dias_restantes integer,
  lote text,
  data_validade date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.nome,
    e.quantidade_atual,
    e.quantidade_minima,
    CASE 
      WHEN e.data_validade IS NOT NULL THEN 
        (e.data_validade - CURRENT_DATE)::integer
      ELSE NULL
    END as dias_restantes,
    e.lote,
    e.data_validade
  FROM public.estoque_medicamentos e
  JOIN public.medicamentos m ON e.medicamento_id = m.id
  WHERE e.ativo = true 
    AND m.ativo = true
    AND (e.quantidade_atual <= e.quantidade_minima 
         OR (e.data_validade IS NOT NULL AND e.data_validade <= CURRENT_DATE + INTERVAL '30 days'))
  ORDER BY e.quantidade_atual ASC, e.data_validade ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Função para obter horários de medicamentos de um residente
CREATE OR REPLACE FUNCTION public.obter_horarios_medicamentos_residente(p_residente_id uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  medicamento_nome text,
  dosagem_prescrita text,
  horarios jsonb,
  via_administracao text,
  observacoes text,
  quantidade_estoque numeric,
  prescricao_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.nome,
    rm.dosagem_prescrita,
    rm.horarios,
    rm.via_administracao,
    rm.observacoes,
    COALESCE(SUM(e.quantidade_atual), 0) as quantidade_estoque,
    rm.id as prescricao_id
  FROM public.residentes_medicamentos rm
  JOIN public.medicamentos m ON rm.medicamento_id = m.id
  LEFT JOIN public.estoque_medicamentos e ON m.id = e.medicamento_id AND e.ativo = true
  WHERE rm.residente_id = p_residente_id
    AND rm.ativo = true
    AND m.ativo = true
    AND (rm.data_inicio <= p_data)
    AND (rm.data_fim IS NULL OR rm.data_fim >= p_data)
  GROUP BY m.nome, rm.dosagem_prescrita, rm.horarios, rm.via_administracao, rm.observacoes, rm.id
  ORDER BY m.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';