DROP POLICY "Admin cria anexos da instituicao" ON public.afastamentos_anexos;
REVOKE INSERT ON public.afastamentos_anexos FROM authenticated;
