
-- Cria a tabela de escalas (caso ainda não exista)
CREATE TABLE IF NOT EXISTS public.escalas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  entrada TIME NOT NULL,
  saida TIME NOT NULL,
  dias_semana TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cria a tabela de funcionários
CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  data_nascimento DATE NOT NULL,
  data_admissao DATE NOT NULL,
  data_inicio_vigencia DATE NOT NULL,
  funcao TEXT NOT NULL,
  escala_id INTEGER NOT NULL REFERENCES public.escalas(id) ON DELETE SET NULL,
  codigo_4_digitos CHAR(4) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita RLS (Row-Level Security) para maior controle de acesso nas duas tabelas
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (ajuste conforme a estratégia desejada: aqui clientes autenticados podem visualizar todas as escalas/funcionarios)
CREATE POLICY "Permite select para usuarios autenticados" ON public.escalas
FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Permite select para usuarios autenticados" ON public.funcionarios
FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- Políticas para inserir e atualizar funcionários
CREATE POLICY "Permite insert para usuarios autenticados" ON public.funcionarios
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permite update para usuarios autenticados" ON public.funcionarios
FOR UPDATE USING (auth.role() = 'authenticated');

