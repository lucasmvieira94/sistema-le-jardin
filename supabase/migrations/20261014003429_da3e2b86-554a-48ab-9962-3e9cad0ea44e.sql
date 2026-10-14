CREATE TABLE public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT public.get_current_tenant_id(),
  nome text NOT NULL,
  descricao text,
  cbo text,
  salario_base numeric(12,2),
  carga_horaria_semanal integer,
  modulos text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cargos_nome_tenant_uniq ON public.cargos (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome)));
GRANT SELECT ON public.cargos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cargos TO authenticated;
GRANT ALL ON public.cargos TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem cargos" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam cargos" ON public.cargos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER cargos_updated_at BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.funcionarios
  ADD COLUMN cargo_id uuid REFERENCES public.cargos(id) ON DELETE RESTRICT,
  ADD COLUMN modulos_extras text[] NOT NULL DEFAULT '{}',
  ADD COLUMN modulos_bloqueados text[] NOT NULL DEFAULT '{}';

-- Módulos efetivos (mesma regra de src/utils/modulosCargo.ts)
CREATE OR REPLACE FUNCTION public.calcular_modulos_funcionario(_cargo_mods text[], _tem_cargo boolean, _supervisor boolean, _extras text[], _bloq text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT m ORDER BY m), '{}') FROM unnest(
    CASE WHEN _tem_cargo THEN COALESCE(_cargo_mods,'{}')
         ELSE ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','feedback']
              || CASE WHEN _supervisor THEN ARRAY['supervisor'] ELSE '{}'::text[] END END
    || COALESCE(_extras,'{}')
  ) m WHERE NOT (m = ANY(COALESCE(_bloq,'{}')));
$$;

CREATE OR REPLACE FUNCTION public.modulos_funcionario(_funcionario_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.calcular_modulos_funcionario(c.modulos, f.cargo_id IS NOT NULL, f.acesso_supervisor, f.modulos_extras, f.modulos_bloqueados)
  FROM public.funcionarios f LEFT JOIN public.cargos c ON c.id = f.cargo_id
  WHERE f.id = _funcionario_id AND f.ativo IS NOT FALSE;
$$;
GRANT EXECUTE ON FUNCTION public.modulos_funcionario(uuid) TO anon, authenticated;

-- Sincroniza texto da função e acesso_supervisor
CREATE OR REPLACE FUNCTION public.sincronizar_cargo_funcionario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NEW.cargo_id IS NOT NULL THEN
    SELECT nome, modulos INTO c FROM public.cargos WHERE id = NEW.cargo_id;
    NEW.funcao := c.nome;
    NEW.acesso_supervisor := 'supervisor' = ANY(public.calcular_modulos_funcionario(c.modulos, true, false, NEW.modulos_extras, NEW.modulos_bloqueados));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER funcionarios_sincronizar_cargo BEFORE INSERT OR UPDATE OF cargo_id, modulos_extras, modulos_bloqueados ON public.funcionarios
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_cargo_funcionario();

CREATE OR REPLACE FUNCTION public.propagar_cargo_funcionarios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.funcionarios SET cargo_id = cargo_id WHERE cargo_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER cargos_propagar AFTER UPDATE OF nome, modulos ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.propagar_cargo_funcionarios();

-- Migração dos dados atuais
INSERT INTO public.cargos (tenant_id, nome, modulos)
SELECT DISTINCT ON (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(funcao)))
  tenant_id, initcap(btrim(regexp_replace(funcao,'\s+',' ','g'))),
  ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','feedback']
FROM public.funcionarios WHERE btrim(COALESCE(funcao,'')) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.funcionarios f SET
  modulos_extras = CASE WHEN f.acesso_supervisor THEN ARRAY['supervisor'] ELSE '{}' END,
  cargo_id = c.id
FROM public.cargos c
WHERE COALESCE(c.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(f.tenant_id,'00000000-0000-0000-0000-000000000000'::uuid)
  AND lower(btrim(c.nome)) = lower(btrim(regexp_replace(f.funcao,'\s+',' ','g')));

-- Cargos padrão
INSERT INTO public.cargos (tenant_id, nome, descricao, modulos)
SELECT t.id, v.nome, v.descr, v.mods FROM (SELECT id FROM public.tenants WHERE ativo LIMIT 1) t,
(VALUES
 ('Cuidador(a)','Cuidados diários aos residentes', ARRAY['ponto','prontuario','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','feedback']),
 ('Técnico(a) de Enfermagem','Assistência de enfermagem', ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','feedback']),
 ('Enfermeiro(a)','Responsável técnico de enfermagem', ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','supervisor','feedback']),
 ('Supervisor(a)','Supervisão da equipe', ARRAY['ponto','prontuario','temperatura','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','meus_prontuarios','fraldas','medicamentos','vacinas','supervisor','feedback']),
 ('Administrativo','Rotinas administrativas', ARRAY['ponto','folhas_ponto','escala','documentos','contracheques','desempenho','feedback']),
 ('Serviços Gerais','Limpeza e manutenção', ARRAY['ponto','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','feedback']),
 ('Cozinha','Preparo das refeições', ARRAY['ponto','intercorrencias','folhas_ponto','escala','documentos','contracheques','desempenho','feedback'])
) v(nome,descr,mods)
ON CONFLICT DO NOTHING;