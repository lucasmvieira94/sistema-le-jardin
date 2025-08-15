-- Verificar e atualizar a constraint de tipo_registro para incluir 'falta_abonada'
ALTER TABLE public.registros_ponto 
DROP CONSTRAINT IF EXISTS registros_ponto_tipo_registro_check;

-- Criar nova constraint que inclui 'falta_abonada'
ALTER TABLE public.registros_ponto 
ADD CONSTRAINT registros_ponto_tipo_registro_check 
CHECK (tipo_registro IN ('entrada', 'saida', 'falta', 'falta_abonada', 'ferias', 'atestado', 'abono'));