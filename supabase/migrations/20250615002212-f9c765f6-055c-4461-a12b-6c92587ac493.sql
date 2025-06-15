
-- Adiciona a coluna 'ativo' à tabela de funcionários, padrão TRUE, para indicar se está ativo ou desligado.
ALTER TABLE public.funcionarios
ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;

-- Permite que usuários autenticados possam atualizar o campo 'ativo'
-- (a política de update já cobre updates em geral, mas ao adicionar campos novos é recomendado revisar as políticas se for necessário políticas específicas)
