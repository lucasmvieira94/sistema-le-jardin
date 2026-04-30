import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TenantStatus {
  ativo: boolean;
  motivo_suspensao: string | null;
  data_suspensao: string | null;
  faturaVencida?: {
    numero: string;
    link_pagamento: string | null;
    data_vencimento: string;
  } | null;
}

/**
 * Verifica o status de ativação do tenant e busca a fatura vencida
 * mais antiga, se existir, para exibir na tela de bloqueio.
 */
export function useTenantStatus(tenantId: string | null) {
  const queryClient = useQueryClient();

  const { data: status = null, isLoading } = useQuery<TenantStatus | null>({
    queryKey: ['tenant-status', tenantId],
    enabled: !!tenantId,
    staleTime: 60 * 1000, // 1 min — status pode mudar (suspensão)
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('ativo, motivo_suspensao, data_suspensao')
        .eq('id', tenantId!)
        .maybeSingle();

      if (!tenant) return null;

      let faturaVencida = null;
      if (!tenant.ativo) {
        const { data: fatura } = await supabase
          .from('faturas')
          .select('numero, link_pagamento, data_vencimento')
          .eq('tenant_id', tenantId!)
          .eq('status', 'vencida')
          .order('data_vencimento', { ascending: true })
          .limit(1)
          .maybeSingle();
        faturaVencida = fatura;
      }

      return {
        ativo: tenant.ativo,
        motivo_suspensao: tenant.motivo_suspensao,
        data_suspensao: tenant.data_suspensao,
        faturaVencida,
      };
    },
  });

  return {
    status,
    loading: !!tenantId && isLoading,
    recheck: () => queryClient.invalidateQueries({ queryKey: ['tenant-status', tenantId] }),
  };
}
