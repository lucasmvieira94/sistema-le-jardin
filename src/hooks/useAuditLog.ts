import { supabase } from '@/integrations/supabase/client';

export function useAuditLog() {
  const logEvent = async (
    tabela: string,
    operacao: string,
    dadosAnteriores?: any,
    dadosNovos?: any
  ) => {
    try {
      await supabase.rpc('log_audit_event', {
        p_tabela: tabela,
        p_operacao: operacao,
        p_dados_anteriores: dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
        p_dados_novos: dadosNovos ? JSON.stringify(dadosNovos) : null
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  };

  return { logEvent };
}