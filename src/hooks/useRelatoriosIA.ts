import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenant } from './useTenant';

export interface RelatorioSemanalIA {
  id: string;
  tenant_id: string;
  data_inicio: string;
  data_fim: string;
  relatorio: any;
  resumo_executivo: string;
  total_prontuarios: number;
  nao_conformidades_encontradas: number;
  gerado_em: string;
  created_at: string;
  updated_at: string;
}

export interface AlertaNaoConformidade {
  id: string;
  tenant_id: string;
  relatorio_id: string;
  residente_id?: string;
  tipo_alerta: 'critico' | 'atencao' | 'informativo';
  categoria: string;
  descricao: string;
  detalhes: any;
  data_ocorrencia: string;
  status: 'pendente' | 'visualizado' | 'resolvido';
  visualizado_por?: string;
  visualizado_em?: string;
  resolvido_por?: string;
  resolvido_em?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export const useRelatoriosIA = () => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Buscar relatórios
  const { data: relatorios = [], isLoading: isLoadingRelatorios } = useQuery({
    queryKey: ['relatorios-ia', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatorios_semanais_ia')
        .select('*')
        .order('data_inicio', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as RelatorioSemanalIA[];
    },
    enabled: !!tenantId,
  });

  // Buscar alertas
  const { data: alertas = [], isLoading: isLoadingAlertas } = useQuery({
    queryKey: ['alertas-nao-conformidade', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas_nao_conformidade')
        .select('*')
        .order('data_ocorrencia', { ascending: false });
      
      if (error) throw error;
      return data as AlertaNaoConformidade[];
    },
    enabled: !!tenantId,
  });

  // Gerar novo relatório
  const gerarRelatorio = useMutation({
    mutationFn: async ({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) => {
      const { data, error } = await supabase.functions.invoke('analisar-prontuarios', {
        body: { 
          dataInicio, 
          dataFim,
          tenantId 
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorios-ia'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-nao-conformidade'] });
      toast.success('Relatório gerado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao gerar relatório:', error);
      toast.error(error.message || 'Erro ao gerar relatório');
    },
  });

  // Atualizar status de alerta
  const atualizarStatusAlerta = useMutation({
    mutationFn: async ({ 
      alertaId, 
      status, 
      observacoes 
    }: { 
      alertaId: string; 
      status: 'visualizado' | 'resolvido'; 
      observacoes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = {
        status,
        observacoes,
      };

      if (status === 'visualizado') {
        updates.visualizado_por = user?.id;
        updates.visualizado_em = new Date().toISOString();
      } else if (status === 'resolvido') {
        updates.resolvido_por = user?.id;
        updates.resolvido_em = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('alertas_nao_conformidade')
        .update(updates)
        .eq('id', alertaId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-nao-conformidade'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do alerta');
    },
  });

  return {
    relatorios,
    isLoadingRelatorios,
    alertas,
    isLoadingAlertas,
    gerarRelatorio,
    atualizarStatusAlerta,
  };
};