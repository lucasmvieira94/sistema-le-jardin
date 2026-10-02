CREATE TABLE public.avisos_funcionario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tenant_id uuid,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  mensagem text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX avisos_funcionario_pendentes_idx ON public.avisos_funcionario (funcionario_id) WHERE confirmado_em IS NULL;

GRANT SELECT ON public.avisos_funcionario TO authenticated;
GRANT ALL ON public.avisos_funcionario TO service_role;
ALTER TABLE public.avisos_funcionario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem avisos da empresa" ON public.avisos_funcionario
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER avisos_funcionario_updated_at BEFORE UPDATE ON public.avisos_funcionario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aviso automático quando um novo período de escala começa
CREATE OR REPLACE FUNCTION public.avisar_mudanca_escala()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ant RECORD; v_esc RECORD; v_tipo text; v_titulo text; v_msg text;
BEGIN
  SELECT nome, jornada_trabalho, entrada, saida INTO v_esc FROM escalas WHERE id = NEW.escala_id;
  SELECT * INTO v_ant FROM funcionarios_escalas_historico
   WHERE funcionario_id = NEW.funcionario_id AND id <> NEW.id AND data_fim = NEW.data_inicio - 1 LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF; -- período inicial/importação: sem aviso
  IF v_ant.escala_id = NEW.escala_id THEN
    v_tipo := 'mudanca_revezamento';
    v_titulo := 'Mudança no seu dia de revezamento';
    v_msg := format('A partir de %s você continua na escala %s, mas passa a trabalhar nesse dia e segue a nova sequência (%s às %s).',
      to_char(NEW.data_inicio, 'DD/MM/YYYY'), v_esc.nome, left(v_esc.entrada::text,5), left(v_esc.saida::text,5));
  ELSE
    v_tipo := 'mudanca_escala';
    v_titulo := 'Sua escala de trabalho mudou';
    v_msg := format('A partir de %s sua escala passa a ser %s (%s, %s às %s).',
      to_char(NEW.data_inicio, 'DD/MM/YYYY'), v_esc.nome, v_esc.jornada_trabalho, left(v_esc.entrada::text,5), left(v_esc.saida::text,5));
  END IF;
  IF NEW.motivo IS NOT NULL THEN v_msg := v_msg || ' Motivo: ' || NEW.motivo; END IF;
  INSERT INTO avisos_funcionario (funcionario_id, tenant_id, tipo, titulo, mensagem, dados, criado_por)
  VALUES (NEW.funcionario_id, NEW.tenant_id, v_tipo, v_titulo, v_msg,
          jsonb_build_object('periodo_id', NEW.id, 'escala_id', NEW.escala_id, 'data_inicio', NEW.data_inicio), auth.uid());
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.avisar_mudanca_escala() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_avisar_mudanca_escala AFTER INSERT ON public.funcionarios_escalas_historico
  FOR EACH ROW EXECUTE FUNCTION public.avisar_mudanca_escala();

-- Portal do funcionário (acesso por código, sem login)
CREATE OR REPLACE FUNCTION public.listar_avisos_pendentes_funcionario(p_funcionario_id uuid)
RETURNS TABLE(id uuid, tipo text, titulo text, mensagem text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.tipo, a.titulo, a.mensagem, a.created_at
  FROM avisos_funcionario a JOIN funcionarios f ON f.id = a.funcionario_id AND f.ativo
  WHERE a.funcionario_id = p_funcionario_id AND a.confirmado_em IS NULL
  ORDER BY a.created_at
$$;

CREATE OR REPLACE FUNCTION public.confirmar_aviso_funcionario(p_funcionario_id uuid, p_aviso_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
  UPDATE avisos_funcionario SET confirmado_em = now()
   WHERE id = p_aviso_id AND funcionario_id = p_funcionario_id AND confirmado_em IS NULL
   RETURNING * INTO v;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO audit_log (user_id, tabela, operacao, dados_novos, tenant_id)
  VALUES (NULL, 'avisos_funcionario', 'CONFIRMAR_RECEBIMENTO',
          jsonb_build_object('aviso_id', v.id, 'funcionario_id', v.funcionario_id, 'confirmado_em', v.confirmado_em), v.tenant_id);
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.listar_avisos_pendentes_funcionario(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_aviso_funcionario(uuid, uuid) TO anon, authenticated;