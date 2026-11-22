import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { restaurarPasse } from '@/utils/portalSessao';
import type { PainelSupervisao } from '@/utils/supervisaoCuidados';

/** Snapshot autorizado no servidor; polling sem canais Realtime nem dados de outras instituições. */
export function useSupervisaoCuidados() {
  const [data, setData] = useState<PainelSupervisao | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const ocupado = useRef(false);
  const montado = useRef(true);
  const carregar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setRefreshing(true);
    try {
      restaurarPasse();
      const { data: snapshot, error: falha } = await supabase.rpc('portal_supervisao_painel');
      if (falha) throw falha;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Resposta do painel indisponível');
      if (montado.current) { setData(snapshot as unknown as PainelSupervisao); setError(null); }
    } catch (e) {
      if (montado.current) {
        const negado = typeof e === 'object' && e !== null && 'code' in e && e.code === '42501';
        if (negado) setData(null);
        setError(negado ? 'Acesso não autorizado. Entre com um PIN com o módulo Supervisão liberado.' : 'Não foi possível atualizar. Os dados podem estar desatualizados.');
      }
    } finally {
      ocupado.current = false;
      if (montado.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    montado.current = true;
    void carregar();
    const atualizar = () => { if (document.visibilityState === 'visible') void carregar(); };
    const timer = setInterval(atualizar, 30000);
    document.addEventListener('visibilitychange', atualizar);
    window.addEventListener('focus', atualizar);
    return () => { montado.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', atualizar); window.removeEventListener('focus', atualizar); };
  }, [carregar]);
  return { data, error, loading, refreshing, refetch: carregar };
}