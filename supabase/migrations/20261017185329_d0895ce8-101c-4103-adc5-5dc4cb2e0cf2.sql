CREATE TABLE public.fichas_acolhimento_envios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ficha_id uuid NOT NULL UNIQUE REFERENCES public.fichas_acolhimento(id), tenant_id uuid, status text NOT NULL DEFAULT 'pendente', destinatario text, enviado_em timestamptz, provider_id text, erro text, tentativas integer NOT NULL DEFAULT 0, capacidade_hash text, processando_em timestamptz, pdf_base64 text, documento_id uuid REFERENCES public.documentos_emitidos(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fichas_acolhimento_envios TO service_role;
ALTER TABLE public.fichas_acolhimento_envios ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER fichas_envios_updated BEFORE UPDATE ON public.fichas_acolhimento_envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.disparar_ficha_acolhimento_email(p_envio uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,net,extensions AS $$
DECLARE v_token text; v_status text; v_tentativas int;
BEGIN
 SELECT status,tentativas INTO v_status,v_tentativas FROM public.fichas_acolhimento_envios WHERE id=p_envio FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF v_status='enviado' OR v_tentativas>=5 THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='ficha-email-'||p_envio::text;
  RETURN;
 END IF;
 v_token:=encode(public.gen_random_bytes(32),'hex');
 UPDATE public.fichas_acolhimento_envios SET capacidade_hash=encode(public.digest(v_token,'sha256'),'hex') WHERE id=p_envio;
 PERFORM net.http_post(url:='https://kvjgmqicictxxfnvhuwl.supabase.co/functions/v1/enviar-ficha-acolhimento', headers:=jsonb_build_object('Content-Type','application/json','x-ficha-capacidade',v_token), body:=jsonb_build_object('envio_id',p_envio));
END; $$;
REVOKE ALL ON FUNCTION public.disparar_ficha_acolhimento_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.disparar_ficha_acolhimento_email(uuid) TO service_role;
CREATE FUNCTION public.agendar_ficha_acolhimento_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_envio uuid;
BEGIN
 IF NEW.status NOT IN ('preenchida','aprovada') THEN RETURN NEW; END IF;
 INSERT INTO public.fichas_acolhimento_envios(ficha_id,tenant_id) VALUES(NEW.id,NEW.tenant_id) ON CONFLICT(ficha_id) DO NOTHING RETURNING id INTO v_envio;
 IF v_envio IS NOT NULL THEN
  PERFORM cron.schedule('ficha-email-'||v_envio::text,'0 * * * *',format('SELECT public.disparar_ficha_acolhimento_email(%L::uuid)',v_envio));
  PERFORM public.disparar_ficha_acolhimento_email(v_envio);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.agendar_ficha_acolhimento_email() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.concluir_ficha_acolhimento_email(p_envio uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.fichas_acolhimento_envios WHERE id=p_envio AND (status='enviado' OR tentativas>=5)) THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='ficha-email-'||p_envio::text;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.concluir_ficha_acolhimento_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_ficha_acolhimento_email(uuid) TO service_role;