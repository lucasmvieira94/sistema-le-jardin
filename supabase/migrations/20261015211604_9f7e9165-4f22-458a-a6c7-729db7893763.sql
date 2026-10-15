CREATE OR REPLACE FUNCTION public.certificar_confirmacao_folha()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text; v_dados jsonb; v_hash text; v_id uuid;
BEGIN
 IF NEW.confirmado_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.confirmado_at IS NOT DISTINCT FROM OLD.confirmado_at) THEN RETURN NEW; END IF;
 SELECT nome_completo INTO v_nome FROM funcionarios WHERE id = NEW.funcionario_id;
 v_dados := jsonb_build_object('folha_id',NEW.id,'funcionario_id',NEW.funcionario_id,'nome',v_nome,'mes',NEW.mes,'ano',NEW.ano,'concorda',NEW.confirmado,'motivo',NEW.motivo_discordancia,'confirmado_em',NEW.confirmado_at);
 v_hash := upper(encode(digest(v_dados::text,'sha256'),'hex'));
 INSERT INTO documentos_emitidos(tipo,referencia_id,referencia_tabela,titular_nome,hash_sha256,dados_estruturais,tenant_id)
 VALUES ('recibo_confirmacao',NEW.id,'folhas_ponto',coalesce(v_nome,'Colaborador'),v_hash,v_dados,NEW.tenant_id) RETURNING id INTO v_id;
 INSERT INTO documentos_auditoria(documento_id,acao,metadata) VALUES(v_id,'gerado',jsonb_build_object('origem','confirmacao_folha'));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.certificar_confirmacao_folha() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER certificar_confirmacao_folha AFTER INSERT OR UPDATE OF confirmado_at ON public.folhas_ponto FOR EACH ROW EXECUTE FUNCTION public.certificar_confirmacao_folha();
CREATE OR REPLACE FUNCTION public.certificado_confirmacao_folha(p_folha_id uuid,p_funcionario_id uuid,p_confirmado_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 SELECT jsonb_build_object('codigo_verificador',d.codigo_verificador,'hash',d.hash_sha256,'dados',d.dados_estruturais) INTO v
 FROM documentos_emitidos d JOIN folhas_ponto f ON f.id=d.referencia_id
 WHERE d.tipo='recibo_confirmacao' AND f.id=p_folha_id AND f.funcionario_id=p_funcionario_id AND f.confirmado_at=p_confirmado_at
 AND (d.dados_estruturais->>'confirmado_em')::timestamptz=p_confirmado_at;
 IF v IS NULL THEN RAISE EXCEPTION 'Comprovante de confirmação não encontrado'; END IF;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.certificado_confirmacao_folha(uuid,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certificado_confirmacao_folha(uuid,uuid,timestamptz) TO anon,authenticated,service_role;