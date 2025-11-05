import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AlertaConfig {
  id?: string;
  user_id?: string;
  tipo_alerta: string;
  notificar_push: boolean;
  notificar_email: boolean;
  notificar_dashboard: boolean;
  condicoes?: Record<string, any>;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useAlertasConfig = () => {
  const queryClient = useQueryClient();

  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ['alertas-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_alertas_usuarios')
        .select('*')
        .order('tipo_alerta');
      
      if (error) throw error;
      return data as AlertaConfig[];
    },
  });

  const salvarConfiguracao = useMutation({
    mutationFn: async (config: Partial<AlertaConfig>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const configData = {
        ...config,
        user_id: user.id,
      };

      if (config.id) {
        const { data, error } = await supabase
          .from('configuracoes_alertas_usuarios')
          .update(configData)
          .eq('id', config.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('configuracoes_alertas_usuarios')
          .insert([configData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-config'] });
      toast.success('Configuração salva com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    },
  });

  return {
    configuracoes,
    isLoading,
    salvarConfiguracao,
  };
};
