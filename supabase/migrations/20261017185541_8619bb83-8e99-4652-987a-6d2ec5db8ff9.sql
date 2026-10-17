CREATE POLICY "Somente servico de envio" ON public.fichas_acolhimento_envios FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION public.agendar_ficha_acolhimento_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('preenchida','aprovada') THEN
 INSERT INTO public.fichas_acolhimento_envios(ficha_id,tenant_id) VALUES(NEW.id,NEW.tenant_id) ON CONFLICT(ficha_id) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION public.acordar_envio_ficha() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM cron.schedule('ficha-email-'||NEW.id::text,'0 * * * *',format('SELECT public.disparar_ficha_acolhimento_email(%L::uuid)',NEW.id));
 PERFORM public.disparar_ficha_acolhimento_email(NEW.id);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.acordar_envio_ficha() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER envio_ficha_inserido AFTER INSERT ON public.fichas_acolhimento_envios FOR EACH ROW EXECUTE FUNCTION public.acordar_envio_ficha();
CREATE FUNCTION public.reservar_envio_ficha(p_envio uuid,p_hash text) RETURNS SETOF public.fichas_acolhimento_envios LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.fichas_acolhimento_envios SET status='processando',processando_em=now(),tentativas=tentativas+1 WHERE id=p_envio AND capacidade_hash=p_hash AND status<>'enviado' AND tentativas<5 AND (processando_em IS NULL OR processando_em<now()-interval '10 minutes') RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.reservar_envio_ficha(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_envio_ficha(uuid,text) TO service_role;