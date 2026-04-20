import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Intercorrencia {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  funcionario_id: string;
  residente_id: string | null;
  prazo_resolucao: string | null;
  data_resolucao: string | null;
  feedback_gestor: string | null;
  feedback_data: string | null;
  feedback_por: string | null;
  imagens: string[] | null;
  created_at: string;
  updated_at: string;
  funcionarios?: { nome_completo: string } | null;
  residentes?: { nome_completo: string } | null;
}

export interface IntercorrenciaLog {
  id: string;
  intercorrencia_id: string;
  acao: string;
  descricao: string | null;
  usuario_nome: string;
  usuario_tipo: string;
  created_at: string;
}

export function useIntercorrencias(funcionarioId?: string) {
  const [intercorrencias, setIntercorrencias] = useState<Intercorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchIntercorrencias = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('intercorrencias')
        .select('*, funcionarios!intercorrencias_funcionario_id_fkey(nome_completo), residentes(nome_completo)')
        .order('created_at', { ascending: false });

      if (funcionarioId) {
        query = query.eq('funcionario_id', funcionarioId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setIntercorrencias((data as any) || []);
    } catch (error: any) {
      console.error('Erro ao buscar intercorrências:', error);
    } finally {
      setLoading(false);
    }
  }, [funcionarioId]);

  useEffect(() => {
    fetchIntercorrencias();
  }, [fetchIntercorrencias]);

  const criarIntercorrencia = async (dados: {
    titulo: string;
    descricao: string;
    categoria: string;
    prioridade: string;
    funcionario_id: string;
    residente_id?: string;
    imagens?: string[];
  }, funcionarioNome: string) => {
    try {
      const { data, error } = await supabase
        .from('intercorrencias')
        .insert(dados as any)
        .select()
        .single();

      if (error) throw error;

      // Criar log de criação
      await supabase.from('intercorrencias_logs').insert({
        intercorrencia_id: (data as any).id,
        acao: 'criacao',
        descricao: `Intercorrência registrada: ${dados.titulo}`,
        usuario_nome: funcionarioNome,
        usuario_tipo: 'funcionario',
      } as any);

      toast({ title: 'Intercorrência registrada com sucesso!' });
      await fetchIntercorrencias();
      return data;
    } catch (error: any) {
      console.error('Erro ao registrar intercorrência:', error);
      toast({ title: 'Erro ao registrar intercorrência', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const atualizarStatus = async (id: string, status: string, usuarioNome: string, usuarioTipo: string) => {
    try {
      const updateData: any = { status };
      if (status === 'resolvida' || status === 'encerrada') {
        updateData.data_resolucao = new Date().toISOString();
      }

      const { error } = await supabase
        .from('intercorrencias')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await supabase.from('intercorrencias_logs').insert({
        intercorrencia_id: id,
        acao: 'alteracao_status',
        descricao: `Status alterado para: ${status}`,
        usuario_nome: usuarioNome,
        usuario_tipo: usuarioTipo,
      } as any);

      toast({ title: 'Status atualizado!' });
      await fetchIntercorrencias();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    }
  };

  const definirPrazo = async (id: string, prazo: string, usuarioNome: string, usuarioTipo: string) => {
    try {
      const { error } = await supabase
        .from('intercorrencias')
        .update({ prazo_resolucao: prazo } as any)
        .eq('id', id);

      if (error) throw error;

      await supabase.from('intercorrencias_logs').insert({
        intercorrencia_id: id,
        acao: 'definicao_prazo',
        descricao: `Prazo definido para: ${new Date(prazo).toLocaleDateString('pt-BR')}`,
        usuario_nome: usuarioNome,
        usuario_tipo: usuarioTipo,
      } as any);

      toast({ title: 'Prazo definido!' });
      await fetchIntercorrencias();
    } catch (error: any) {
      toast({ title: 'Erro ao definir prazo', description: error.message, variant: 'destructive' });
    }
  };

  const enviarFeedback = async (id: string, feedback: string, feedbackPorId: string, usuarioNome: string, usuarioTipo: string) => {
    try {
      const { error } = await supabase
        .from('intercorrencias')
        .update({
          feedback_gestor: feedback,
          feedback_data: new Date().toISOString(),
          feedback_por: feedbackPorId,
        } as any)
        .eq('id', id);

      if (error) throw error;

      await supabase.from('intercorrencias_logs').insert({
        intercorrencia_id: id,
        acao: 'feedback',
        descricao: `Feedback enviado: ${feedback.substring(0, 100)}...`,
        usuario_nome: usuarioNome,
        usuario_tipo: usuarioTipo,
      } as any);

      toast({ title: 'Feedback enviado!' });
      await fetchIntercorrencias();
    } catch (error: any) {
      toast({ title: 'Erro ao enviar feedback', description: error.message, variant: 'destructive' });
    }
  };

  const buscarLogs = async (intercorrenciaId: string): Promise<IntercorrenciaLog[]> => {
    try {
      const { data, error } = await supabase
        .from('intercorrencias_logs')
        .select('*')
        .eq('intercorrencia_id', intercorrenciaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as any) || [];
    } catch {
      return [];
    }
  };

  return {
    intercorrencias,
    loading,
    criarIntercorrencia,
    atualizarStatus,
    definirPrazo,
    enviarFeedback,
    buscarLogs,
    refetch: fetchIntercorrencias,
  };
}
