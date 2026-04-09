
-- Criar enum para níveis de gamificação
CREATE TYPE public.gamification_nivel AS ENUM ('bronze', 'prata', 'ouro', 'diamante');

-- Criar enum para tipos de transação
CREATE TYPE public.gamification_transaction_tipo AS ENUM (
  'plantao', 'micro_tarefa_ponto', 'micro_tarefa_prontuario',
  'falta_injustificada', 'advertencia_verbal', 'advertencia_escrita',
  'suspensao', 'resgate', 'bonus_manual', 'penalidade_manual'
);

-- Função de updated_at para gamificação
CREATE OR REPLACE FUNCTION public.update_gamification_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Perfil de gamificação por funcionário
CREATE TABLE public.gamification_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  moedas INTEGER NOT NULL DEFAULT 0,
  streak_plantoes INTEGER NOT NULL DEFAULT 0,
  ultimo_plantao_data DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id)
);

-- Histórico de transações
CREATE TABLE public.gamification_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo public.gamification_transaction_tipo NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  moedas_delta INTEGER NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL,
  referencia_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Catálogo de prêmios
CREATE TABLE public.gamification_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  custo_moedas INTEGER NOT NULL,
  nivel_minimo public.gamification_nivel NOT NULL DEFAULT 'bronze',
  tipo TEXT NOT NULL DEFAULT 'voucher',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Resgates de prêmios
CREATE TABLE public.gamification_resgates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.gamification_rewards(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  aprovado_por UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_gamification_transactions_funcionario ON public.gamification_transactions(funcionario_id);
CREATE INDEX idx_gamification_transactions_tipo ON public.gamification_transactions(tipo);
CREATE INDEX idx_gamification_resgates_status ON public.gamification_resgates(status);

-- RLS
ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_resgates ENABLE ROW LEVEL SECURITY;

-- Policies: gamification_profiles
CREATE POLICY "Admins gerenciam perfis gamificação" ON public.gamification_profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Func veem próprio perfil gamificação" ON public.gamification_profiles FOR SELECT TO authenticated
USING (funcionario_id IN (SELECT id FROM funcionarios WHERE user_id = auth.uid()));
CREATE POLICY "Anon vê perfis gamificação" ON public.gamification_profiles FOR SELECT TO anon USING (true);

-- Policies: gamification_transactions
CREATE POLICY "Admins gerenciam transações gamificação" ON public.gamification_transactions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Func veem próprias transações" ON public.gamification_transactions FOR SELECT TO authenticated
USING (funcionario_id IN (SELECT id FROM funcionarios WHERE user_id = auth.uid()));
CREATE POLICY "Anon vê transações gamificação" ON public.gamification_transactions FOR SELECT TO anon USING (true);

-- Policies: gamification_rewards
CREATE POLICY "Admins gerenciam catálogo prêmios" ON public.gamification_rewards FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Todos veem prêmios ativos" ON public.gamification_rewards FOR SELECT USING (ativo = true);

-- Policies: gamification_resgates
CREATE POLICY "Admins gerenciam resgates" ON public.gamification_resgates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Func veem próprios resgates" ON public.gamification_resgates FOR SELECT TO authenticated
USING (funcionario_id IN (SELECT id FROM funcionarios WHERE user_id = auth.uid()));
CREATE POLICY "Anon vê resgates" ON public.gamification_resgates FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insere resgates" ON public.gamification_resgates FOR INSERT TO anon WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_gp_updated_at BEFORE UPDATE ON public.gamification_profiles FOR EACH ROW EXECUTE FUNCTION public.update_gamification_updated_at();
CREATE TRIGGER update_gr_updated_at BEFORE UPDATE ON public.gamification_rewards FOR EACH ROW EXECUTE FUNCTION public.update_gamification_updated_at();
CREATE TRIGGER update_gres_updated_at BEFORE UPDATE ON public.gamification_resgates FOR EACH ROW EXECUTE FUNCTION public.update_gamification_updated_at();

-- Catálogo inicial
INSERT INTO public.gamification_rewards (nome, descricao, custo_moedas, nivel_minimo, tipo) VALUES
('Par de Ingressos de Cinema', 'Par de ingressos para sessão de cinema à escolha do funcionário', 200, 'bronze', 'voucher'),
('Voucher Lanche/Chocolate', 'Voucher de R$ 40,00 para lanche ou chocolate', 500, 'prata', 'voucher'),
('Meio Período de Folga', 'Sair mais cedo ou chegar mais tarde em um plantão', 1000, 'ouro', 'folga'),
('01 Dia de Folga', 'Um dia de folga completo à escolha do funcionário', 2000, 'diamante', 'folga'),
('Bonificação R$ 120,00', 'Bonificação em dinheiro equivalente a um plantão extra', 2000, 'diamante', 'dinheiro');

-- Função para calcular nível
CREATE OR REPLACE FUNCTION public.calcular_nivel_gamificacao(p_xp INTEGER)
RETURNS public.gamification_nivel LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_xp >= 3000 THEN 'diamante'::public.gamification_nivel
    WHEN p_xp >= 1501 THEN 'ouro'::public.gamification_nivel
    WHEN p_xp >= 501 THEN 'prata'::public.gamification_nivel
    ELSE 'bronze'::public.gamification_nivel
  END;
$$;
