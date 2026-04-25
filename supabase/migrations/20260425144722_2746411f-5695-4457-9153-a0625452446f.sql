INSERT INTO public.user_roles (user_id, role)
VALUES ('450f212e-93a0-4288-a19d-549fe51d58be', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;