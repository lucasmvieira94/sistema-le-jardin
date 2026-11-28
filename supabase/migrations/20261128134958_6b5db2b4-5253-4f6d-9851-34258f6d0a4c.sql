ALTER TABLE public.contratos_residentes ADD COLUMN prazo_prorrogado date;
ALTER TABLE public.contratos_distratos ADD COLUMN prazo_prorrogado date;
CREATE TABLE public.contratos_aditivos (
 id uuid PRIMARY KEY,
 contrato_id uuid NOT NULL REFERENCES public.contratos_residentes(id),
 distrato_id uuid REFERENCES public.contratos_distratos(id),
 tenant_id uuid NOT NULL,
 numero_aditivo text NOT NULL,
 data_anterior date,
 nova_data date NOT NULL,
 condicoes text NOT NULL DEFAULT '',
 dados_documento jsonb NOT NULL,
 criado_por uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contratos_aditivos TO authenticated;
GRANT ALL ON public.contratos_aditivos TO service_role;
ALTER TABLE public.contratos_aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY aditivos_gestor_leitura ON public.contratos_aditivos FOR SELECT TO authenticated
 USING (coalesce(public.eh_gestor(auth.uid()),false) AND tenant_id = public.get_current_tenant_id());
CREATE INDEX contratos_aditivos_contrato_idx ON public.contratos_aditivos(contrato_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.criar_aditivo_prorrogacao(_id uuid, _contrato uuid, _distrato uuid, _nova_data date, _condicoes text, _prazo_atual date)
RETURNS public.contratos_aditivos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.contratos_residentes; d public.contratos_distratos; a public.contratos_aditivos; prazo date; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; residente jsonb;
BEGIN
 IF NOT coalesce(public.eh_gestor(auth.uid()),false) THEN RAISE EXCEPTION 'Somente gestores podem criar aditivos' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.contratos_residentes WHERE id=_contrato FOR UPDATE;
 IF NOT FOUND OR c.tenant_id IS DISTINCT FROM public.get_current_tenant_id() THEN RAISE EXCEPTION 'Contrato não autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.contratos_aditivos WHERE id=_id;
 IF FOUND THEN
  IF a.contrato_id=_contrato AND a.distrato_id IS NOT DISTINCT FROM _distrato AND a.nova_data=_nova_data AND a.condicoes=coalesce(trim(_condicoes),'') THEN RETURN a; END IF;
  RAISE EXCEPTION 'Identificador já utilizado';
 END IF;
 IF c.status='encerrado' THEN RAISE EXCEPTION 'Contrato encerrado não pode ser prorrogado'; END IF;
 IF _distrato IS NOT NULL THEN
  SELECT * INTO d FROM public.contratos_distratos WHERE id=_distrato AND contrato_id=c.id AND tenant_id=c.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distrato não autorizado' USING ERRCODE='42501'; END IF;
  prazo:=coalesce(d.prazo_prorrogado,d.data_efetiva);
 ELSE
  IF EXISTS(SELECT 1 FROM public.contratos_distratos WHERE contrato_id=c.id) THEN RAISE EXCEPTION 'Prorrogue o distrato para alterar a data de encerramento'; END IF;
  prazo:=coalesce(c.prazo_prorrogado,c.data_fim_contrato);
 END IF;
 IF prazo IS DISTINCT FROM _prazo_atual THEN RAISE EXCEPTION 'O prazo foi alterado. Atualize a lista antes de continuar'; END IF;
 IF _nova_data IS NULL OR _nova_data<=greatest(coalesce(prazo,c.data_inicio_contrato),hoje) THEN RAISE EXCEPTION 'O novo término deve ser posterior ao prazo atual e à data de hoje'; END IF;
 IF length(coalesce(_condicoes,''))>5000 THEN RAISE EXCEPTION 'Condições limitadas a 5000 caracteres'; END IF;
 SELECT jsonb_build_object('nome_completo',r.nome_completo,'cpf',r.cpf,'numero_prontuario',r.numero_prontuario) INTO residente FROM public.residentes r WHERE r.id=c.residente_id AND r.tenant_id=c.tenant_id;
 INSERT INTO public.contratos_aditivos(id,contrato_id,distrato_id,tenant_id,numero_aditivo,data_anterior,nova_data,condicoes,dados_documento,criado_por)
 VALUES(_id,c.id,_distrato,c.tenant_id,'A-'||c.numero_contrato||'-'||(SELECT count(*)+1 FROM public.contratos_aditivos WHERE contrato_id=c.id),prazo,_nova_data,coalesce(trim(_condicoes),''),
 jsonb_build_object('contrato',to_jsonb(c),'distrato',CASE WHEN _distrato IS NULL THEN NULL ELSE to_jsonb(d) END,'residente',residente,'data_emissao',hoje),auth.uid()) RETURNING * INTO a;
 UPDATE public.contratos_residentes SET prazo_prorrogado=_nova_data,updated_at=now() WHERE id=c.id;
 IF _distrato IS NOT NULL THEN UPDATE public.contratos_distratos SET prazo_prorrogado=_nova_data,updated_at=now() WHERE id=d.id; END IF;
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION public.criar_aditivo_prorrogacao(uuid,uuid,uuid,date,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_aditivo_prorrogacao(uuid,uuid,uuid,date,text,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.encerrar_contratos_distratados() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.contratos_residentes c SET status='encerrado'
 WHERE c.status<>'encerrado' AND EXISTS(SELECT 1 FROM public.contratos_distratos d WHERE d.contrato_id=c.id AND coalesce(d.prazo_prorrogado,d.data_efetiva)<=(now() AT TIME ZONE 'America/Sao_Paulo')::date);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;