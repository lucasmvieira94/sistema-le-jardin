-- Criar trigger para processar afastamentos automaticamente
CREATE OR REPLACE TRIGGER trigger_processar_afastamento
AFTER INSERT ON public.afastamentos
FOR EACH ROW
EXECUTE FUNCTION public.processar_afastamento();