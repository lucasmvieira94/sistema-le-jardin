import { useEffect, useState, useCallback } from 'react';
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
  const [status, setStatus] = useState<TenantStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checar = useCallback(async () => {
    if (!tenantId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('ativo, motivo_suspensao, data_suspensao')
        .eq('id', tenantId)
        .maybeSingle();

      if (!tenant) {
        setStatus(null);
        return;
      }

      let faturaVencida = null;
      if (!tenant.ativo) {
        const { data: fatura } = await supabase
          .from('faturas')
          .select('numero, link_pagamento, data_vencimento')
          .eq('tenant_id', tenantId)
          .eq('status', 'vencida')
          .order('data_vencimento', { ascending: true })
          .limit(1)
          .maybeSingle();
        faturaVencida = fatura;
      }

      setStatus({
        ativo: tenant.ativo,
        motivo_suspensao: tenant.motivo_suspensao,
        data_suspensao: tenant.data_suspensao,
        faturaVencida,
      });
    } catch (e) {
      console.error('Erro ao checar status do tenant:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { checar(); }, [checar]);

  return { status, loading, recheck: checar };
}
