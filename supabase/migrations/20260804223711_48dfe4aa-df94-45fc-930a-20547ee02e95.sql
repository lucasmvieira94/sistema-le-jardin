UPDATE public.funcionarios f
SET tenant_id = 'e33e7b6a-477b-4d20-866c-2020c93287cd'
WHERE f.tenant_id IS NULL;

ALTER TABLE public.funcionarios ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();