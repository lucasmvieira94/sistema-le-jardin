import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

export interface Plano {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number;
  limite_funcionarios: number;
  limite_residentes: number;
  limite_usuarios_admin: number;
  modulos_inclusos: string[];
  ordem: number;
  destaque: boolean;
  ativo: boolean;
}

export interface Assinatura {
  id: string;
  tenant_id: string;
  plano_id: string;
  status: 'trial' | 'ativa' | 'inadimplente' | 'suspensa' | 'cancelada';
  ciclo: 'mensal' | 'anual';
  valor_contratado: number;
  data_inicio: string;
  data_fim_trial: string | null;
  proxima_cobranca: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  observacoes_admin: string | null;
  plano?: Plano;
}

export interface TenantUso {
  funcionarios_ativos: number;
  residentes_ativos: number;
  usuarios_admin: number;
  registros_ponto_mes: number;
  consultas_ia_mes: number;
  mensagens_whatsapp_mes: number;
}

/**
 * Hook para acessar a assinatura, plano e uso atual do tenant logado.
 * Útil para mostrar informações no portal do cliente e para enforcement de limites.
 */
export function useSubscription() {
  const { tenantId } = useTenantContext();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [uso, setUso] = useState<TenantUso | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [assinaturaRes, usoRes] = await Promise.all([
        supabase
          .from('assinaturas')
          .select('*, plano:planos(*)')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
        supabase
          .from('tenant_uso')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('data_referencia', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (assinaturaRes.data) setAssinatura(assinaturaRes.data as any);
      if (usoRes.data) setUso(usoRes.data as any);
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Calcular dias restantes de trial
  const diasTrialRestantes = (() => {
    if (assinatura?.status !== 'trial' || !assinatura.data_fim_trial) return null;
    const fim = new Date(assinatura.data_fim_trial);
    const hoje = new Date();
    const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  // Verificar se está perto dos limites
  const limitesProximos = (() => {
    if (!assinatura?.plano || !uso) return [];
    const alertas: string[] = [];
    const limite = assinatura.plano;
    if (uso.funcionarios_ativos / limite.limite_funcionarios >= 0.85) {
      alertas.push(`Funcionários: ${uso.funcionarios_ativos}/${limite.limite_funcionarios}`);
    }
    if (uso.residentes_ativos / limite.limite_residentes >= 0.85) {
      alertas.push(`Residentes: ${uso.residentes_ativos}/${limite.limite_residentes}`);
    }
    return alertas;
  })();

  return {
    assinatura,
    plano: assinatura?.plano ?? null,
    uso,
    loading,
    diasTrialRestantes,
    limitesProximos,
    recarregar: carregar,
  };
}