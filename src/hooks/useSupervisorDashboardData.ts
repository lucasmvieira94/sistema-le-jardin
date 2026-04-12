import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardData {
  fraldasEstoque: { total: number; alertas: number; criticos: number; items: any[] };
  medicamentosEstoque: { total: number; alertas: number; vencendo: number; items: any[] };
  intercorrencias: { total: number; abertas: number; criticas: number; resolvidas: number; items: any[] };
  prontuarios: { totalResidentes: number; ciclosHoje: number; encerrados: number; pendentes: number; atrasados: number };
}

const INITIAL: DashboardData = {
  fraldasEstoque: { total: 0, alertas: 0, criticos: 0, items: [] },
  medicamentosEstoque: { total: 0, alertas: 0, vencendo: 0, items: [] },
  intercorrencias: { total: 0, abertas: 0, criticas: 0, resolvidas: 0, items: [] },
  prontuarios: { totalResidentes: 0, ciclosHoje: 0, encerrados: 0, pendentes: 0, atrasados: 0 },
};

export function useSupervisorDashboardData() {
  const [data, setData] = useState<DashboardData>(INITIAL);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const hoje = new Date().toISOString().split('T')[0];
    const em30dias = new Date();
    em30dias.setDate(em30dias.getDate() + 30);

    try {
      const [fraldas, medEstoque, intercorrencias, residentes, ciclosHoje, ciclosAtrasados] = await Promise.all([
        supabase.from('estoque_fraldas').select('id, tipo_fralda, tamanho, marca, quantidade_atual, quantidade_minima, consumo_medio_diario, residente_id, residentes(nome_completo)').eq('ativo', true),
        supabase.from('estoque_medicamentos').select('id, quantidade_atual, quantidade_minima, data_validade, lote, medicamento:medicamentos(nome, controlado)').eq('ativo', true),
        supabase.from('intercorrencias').select('*, funcionarios!intercorrencias_funcionario_id_fkey(nome_completo), residentes(nome_completo)').order('created_at', { ascending: false }).limit(50),
        supabase.from('residentes').select('id').eq('ativo', true),
        supabase.from('prontuario_ciclos').select('id, status').eq('data_ciclo', hoje),
        supabase.from('prontuario_ciclos').select('id').in('status', ['em_andamento', 'nao_iniciado']).lt('data_ciclo', hoje),
      ]);

      const fraldasData = fraldas.data || [];
      const fraldasAlertas = fraldasData.filter(f => f.quantidade_atual <= f.quantidade_minima);
      const fraldasCriticos = fraldasData.filter(f => {
        if (!f.consumo_medio_diario || f.consumo_medio_diario <= 0) return f.quantidade_atual <= 0;
        return Math.floor(f.quantidade_atual / f.consumo_medio_diario) <= 3;
      });

      const medData = medEstoque.data || [];
      const medAlertas = medData.filter(m => m.quantidade_atual <= (m.quantidade_minima || 10));
      const medVencendo = medData.filter(m => m.data_validade && new Date(m.data_validade) <= em30dias);

      const interData = (intercorrencias.data as any[]) || [];
      const ciclosHojeData = ciclosHoje.data || [];

      setData({
        fraldasEstoque: {
          total: fraldasData.length,
          alertas: fraldasAlertas.length,
          criticos: fraldasCriticos.length,
          items: fraldasAlertas.map(f => ({
            ...f,
            residente_nome: (f.residentes as any)?.nome_completo || 'Geral',
            dias_restantes: f.consumo_medio_diario && f.consumo_medio_diario > 0
              ? Math.floor(f.quantidade_atual / f.consumo_medio_diario) : null,
          })),
        },
        medicamentosEstoque: {
          total: medData.length,
          alertas: medAlertas.length,
          vencendo: medVencendo.length,
          items: [...medAlertas, ...medVencendo.filter(m => !medAlertas.includes(m))].map(m => ({
            ...m,
            nome: (m.medicamento as any)?.nome || 'N/A',
            controlado: (m.medicamento as any)?.controlado || false,
          })),
        },
        intercorrencias: {
          total: interData.length,
          abertas: interData.filter(i => i.status === 'aberta').length,
          criticas: interData.filter(i => i.prioridade === 'critica' && i.status !== 'resolvida' && i.status !== 'encerrada').length,
          resolvidas: interData.filter(i => i.status === 'resolvida' || i.status === 'encerrada').length,
          items: interData,
        },
        prontuarios: {
          totalResidentes: residentes.data?.length || 0,
          ciclosHoje: ciclosHojeData.length,
          encerrados: ciclosHojeData.filter(c => c.status === 'encerrado').length,
          pendentes: ciclosHojeData.filter(c => c.status !== 'encerrado').length,
          atrasados: ciclosAtrasados.data?.length || 0,
        },
      });
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
