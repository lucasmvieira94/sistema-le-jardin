import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GamificationNivel = 'bronze' | 'prata' | 'ouro' | 'diamante';

export interface GamificationProfile {
  id: string;
  funcionario_id: string;
  xp_total: number;
  moedas: number;
  streak_plantoes: number;
  ultimo_plantao_data: string | null;
}

export interface GamificationTransaction {
  id: string;
  funcionario_id: string;
  tipo: string;
  xp_delta: number;
  moedas_delta: number;
  descricao: string;
  referencia_id: string | null;
  created_at: string;
}

export interface GamificationReward {
  id: string;
  nome: string;
  descricao: string | null;
  custo_moedas: number;
  nivel_minimo: GamificationNivel;
  tipo: string;
  ativo: boolean;
}

export interface GamificationResgate {
  id: string;
  funcionario_id: string;
  reward_id: string;
  status: string;
  aprovado_por: string | null;
  observacoes: string | null;
  created_at: string;
  gamification_rewards?: GamificationReward;
}

const NIVEL_CONFIG: Record<GamificationNivel, { min: number; max: number; label: string; color: string }> = {
  bronze: { min: 0, max: 500, label: 'Bronze', color: '#CD7F32' },
  prata: { min: 501, max: 1500, label: 'Prata', color: '#C0C0C0' },
  ouro: { min: 1501, max: 3000, label: 'Ouro', color: '#FFD700' },
  diamante: { min: 3001, max: Infinity, label: 'Diamante', color: '#B9F2FF' },
};

export function calcularNivel(xp: number): GamificationNivel {
  if (xp >= 3001) return 'diamante';
  if (xp >= 1501) return 'ouro';
  if (xp >= 501) return 'prata';
  return 'bronze';
}

export function getNivelConfig(nivel: GamificationNivel) {
  return NIVEL_CONFIG[nivel];
}

export function getProgressoNivel(xp: number) {
  const nivel = calcularNivel(xp);
  const config = NIVEL_CONFIG[nivel];
  if (nivel === 'diamante') {
    return { nivel, progresso: 100, xpAtual: xp, xpProximo: config.min, xpNoNivel: xp - config.min + 1 };
  }
  const xpNoNivel = xp - config.min;
  const xpTotalNivel = config.max - config.min + 1;
  const progresso = Math.min(100, Math.round((xpNoNivel / xpTotalNivel) * 100));
  return { nivel, progresso, xpAtual: xp, xpProximo: config.max + 1, xpNoNivel };
}

export function useGamificacaoProfile(funcionarioId: string | null) {
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [transactions, setTransactions] = useState<GamificationTransaction[]>([]);
  const [rewards, setRewards] = useState<GamificationReward[]>([]);
  const [resgates, setResgates] = useState<GamificationResgate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!funcionarioId) { setLoading(false); return; }
    setLoading(true);

    const [profileRes, transRes, rewardsRes, resgatesRes] = await Promise.all([
      supabase.from('gamification_profiles').select('*').eq('funcionario_id', funcionarioId).maybeSingle(),
      supabase.from('gamification_transactions').select('*').eq('funcionario_id', funcionarioId).order('created_at', { ascending: false }).limit(50),
      supabase.from('gamification_rewards').select('*').eq('ativo', true).order('custo_moedas', { ascending: true }),
      supabase.from('gamification_resgates').select('*, gamification_rewards(*)').eq('funcionario_id', funcionarioId).order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data as any);
    if (transRes.data) setTransactions(transRes.data as any);
    if (rewardsRes.data) setRewards(rewardsRes.data as any);
    if (resgatesRes.data) setResgates(resgatesRes.data as any);
    setLoading(false);
  }, [funcionarioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resgatarPremio = async (rewardId: string) => {
    if (!funcionarioId || !profile) return { success: false, error: 'Perfil não encontrado' };
    
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return { success: false, error: 'Prêmio não encontrado' };
    
    const nivel = calcularNivel(profile.xp_total);
    const nivelOrdem: GamificationNivel[] = ['bronze', 'prata', 'ouro', 'diamante'];
    if (nivelOrdem.indexOf(nivel) < nivelOrdem.indexOf(reward.nivel_minimo)) {
      return { success: false, error: 'Nível insuficiente para este prêmio' };
    }
    if (profile.moedas < reward.custo_moedas) {
      return { success: false, error: 'Moedas insuficientes' };
    }

    const { error } = await supabase.from('gamification_resgates').insert({
      funcionario_id: funcionarioId,
      reward_id: rewardId,
      status: 'pendente',
    } as any);

    if (error) return { success: false, error: error.message };
    
    await fetchData();
    return { success: true, error: null };
  };

  return { profile, transactions, rewards, resgates, loading, refetch: fetchData, resgatarPremio };
}

// Hook para admin
export function useGamificacaoAdmin() {
  const [profiles, setProfiles] = useState<(GamificationProfile & { funcionarios?: { nome_completo: string; funcao: string } })[]>([]);
  const [resgatesPendentes, setResgatesPendentes] = useState<any[]>([]);
  const [rewards, setRewards] = useState<GamificationReward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, resgatesRes, rewardsRes] = await Promise.all([
      supabase.from('gamification_profiles').select('*, funcionarios(nome_completo, funcao)').order('xp_total', { ascending: false }),
      supabase.from('gamification_resgates').select('*, funcionarios(nome_completo), gamification_rewards(nome, custo_moedas)').eq('status', 'pendente').order('created_at', { ascending: true }),
      supabase.from('gamification_rewards').select('*').order('custo_moedas', { ascending: true }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as any);
    if (resgatesRes.data) setResgatesPendentes(resgatesRes.data as any);
    if (rewardsRes.data) setRewards(rewardsRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const aprovarResgate = async (resgateId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    // Buscar resgate para pegar dados
    const { data: resgate } = await supabase.from('gamification_resgates').select('*, gamification_rewards(custo_moedas)').eq('id', resgateId).single();
    if (!resgate) return;
    
    // Atualizar status do resgate
    await supabase.from('gamification_resgates').update({ status: 'aprovado', aprovado_por: user?.id } as any).eq('id', resgateId);
    
    // Debitar moedas do perfil
    const custoMoedas = (resgate as any).gamification_rewards?.custo_moedas || 0;
    await supabase.rpc('calcular_nivel_gamificacao' as any, { p_xp: 0 }); // just to ensure function exists
    
    // Atualizar moedas diretamente
    const { data: profileData } = await supabase.from('gamification_profiles').select('moedas').eq('funcionario_id', (resgate as any).funcionario_id).single();
    if (profileData) {
      await supabase.from('gamification_profiles').update({
        moedas: Math.max(0, (profileData as any).moedas - custoMoedas)
      } as any).eq('funcionario_id', (resgate as any).funcionario_id);
    }

    // Registrar transação de resgate
    await supabase.from('gamification_transactions').insert({
      funcionario_id: (resgate as any).funcionario_id,
      tipo: 'resgate',
      xp_delta: 0,
      moedas_delta: -custoMoedas,
      descricao: `Resgate de prêmio aprovado`,
      referencia_id: resgateId,
    } as any);

    await fetchData();
  };

  const rejeitarResgate = async (resgateId: string, motivo?: string) => {
    await supabase.from('gamification_resgates').update({ 
      status: 'rejeitado', 
      observacoes: motivo || 'Resgate rejeitado pelo administrador' 
    } as any).eq('id', resgateId);
    await fetchData();
  };

  const aplicarPontuacao = async (funcionarioId: string, tipo: string, xpDelta: number, moedasDelta: number, descricao: string) => {
    // Garantir que o perfil existe
    const { data: existingProfile } = await supabase.from('gamification_profiles').select('*').eq('funcionario_id', funcionarioId).maybeSingle();
    
    if (!existingProfile) {
      await supabase.from('gamification_profiles').insert({ funcionario_id: funcionarioId } as any);
    }

    // Registrar transação
    await supabase.from('gamification_transactions').insert({
      funcionario_id: funcionarioId,
      tipo,
      xp_delta: xpDelta,
      moedas_delta: moedasDelta,
      descricao,
    } as any);

    // Atualizar perfil
    const { data: profile } = await supabase.from('gamification_profiles').select('*').eq('funcionario_id', funcionarioId).single();
    if (profile) {
      const novoXp = Math.max(0, (profile as any).xp_total + xpDelta);
      const novasMoedas = Math.max(0, (profile as any).moedas + moedasDelta);
      let novoStreak = (profile as any).streak_plantoes;

      if (tipo === 'plantao') {
        novoStreak = novoStreak + 1;
      } else if (tipo === 'falta_injustificada') {
        novoStreak = 0;
      }

      await supabase.from('gamification_profiles').update({
        xp_total: novoXp,
        moedas: novasMoedas,
        streak_plantoes: novoStreak,
        ...(tipo === 'plantao' ? { ultimo_plantao_data: new Date().toISOString().split('T')[0] } : {}),
      } as any).eq('funcionario_id', funcionarioId);
    }

    await fetchData();
  };

  const criarPremio = async (data: Partial<GamificationReward>) => {
    await supabase.from('gamification_rewards').insert(data as any);
    await fetchData();
  };

  const atualizarPremio = async (id: string, data: Partial<GamificationReward>) => {
    await supabase.from('gamification_rewards').update(data as any).eq('id', id);
    await fetchData();
  };

  const deletarPremio = async (id: string) => {
    await supabase.from('gamification_rewards').update({ ativo: false } as any).eq('id', id);
    await fetchData();
  };

  return {
    profiles, resgatesPendentes, rewards, loading, refetch: fetchData,
    aprovarResgate, rejeitarResgate, aplicarPontuacao,
    criarPremio, atualizarPremio, deletarPremio,
  };
}
