-- Fix the infinite recursion issue in funcionarios table policies
-- The "Limited employee lookup for time registration" policy is causing recursion

-- Remove the problematic policy that's causing infinite recursion
DROP POLICY IF EXISTS "Limited employee lookup for time registration" ON public.funcionarios;

-- Create a simple, non-recursive policy for admin access to funcionarios
-- This will allow the funcionarios page to work properly
CREATE POLICY "Admins can view all funcionarios safely" 
ON public.funcionarios 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a safe policy for employees to view their own data
CREATE POLICY "Employees can view own data safely" 
ON public.funcionarios 
FOR SELECT 
USING (user_id = auth.uid());

-- Create a very limited policy for the time registration function only
-- This only allows checking if an employee is active when a valid code is provided
-- We'll handle this through the secure function instead of direct table access