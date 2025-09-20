-- Primeiro, vamos ver quais são os valores permitidos para periodo_dia
-- Vamos alterar a constraint para aceitar 'geral' ou remover a constraint se desnecessária
-- Como removemos o campo periodo_dia do formulário, vamos ajustar a constraint

ALTER TABLE public.controle_temperatura_medicamentos 
DROP CONSTRAINT IF EXISTS controle_temperatura_medicamentos_periodo_dia_check;

-- Agora vamos adicionar uma nova constraint que permite os valores corretos
-- Como o usuário disse que o horário já é suficiente, vamos permitir 'geral' como padrão
ALTER TABLE public.controle_temperatura_medicamentos 
ADD CONSTRAINT controle_temperatura_medicamentos_periodo_dia_check 
CHECK (periodo_dia IN ('manha', 'tarde', 'noite', 'geral'));