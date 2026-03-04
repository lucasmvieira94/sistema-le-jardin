-- Remove overly permissive SELECT policy that exposes CPF, email, and 4-digit codes publicly
DROP POLICY IF EXISTS "Allow select funcionarios for validation" ON public.funcionarios;

-- Create a proper policy that requires authentication
CREATE POLICY "authenticated_can_read_funcionarios"
ON public.funcionarios
FOR SELECT
TO authenticated
USING (true);

-- The RPC function validar_codigo_funcionario (SECURITY DEFINER) already handles
-- unauthenticated employee code validation securely, returning only id and nome_completo.