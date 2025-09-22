import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface AlertaWhatsApp {
  id: string;
  nome: string;
  mensagem: string;
  numeros_destino: string[];
  frequencia_tipo: 'horario_especifico' | 'horas' | 'dias' | 'semanas' | 'meses';
  frequencia_valor: number;
  horario_especifico?: string;
  data_inicio: string;
  ativo: boolean;
  mensagem_dinamica: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface AgendamentoWhatsApp {
  id: string;
  alerta_id: string;
  proxima_execucao: string;
  status: 'agendado' | 'executando' | 'concluido' | 'erro';
  tentativas: number;
  alertas_whatsapp?: Partial<AlertaWhatsApp>;
}

export interface HistoricoNotificacao {
  id: string;
  alerta_id: string;
  numero_destino: string;
  mensagem_enviada: string;
  status: 'enviado' | 'erro' | 'pendente';
  erro_descricao?: string;
  whatsapp_message_id?: string;
  data_envio: string;
  tentativa_numero: number;
  alertas_whatsapp?: Partial<AlertaWhatsApp>;
}

export function useWhatsAppAlertas() {
  const [alertas, setAlertas] = useState<AlertaWhatsApp[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoWhatsApp[]>([]);
  const [historico, setHistorico] = useState<HistoricoNotificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Carregar alertas
  const carregarAlertas = async () => {
    try {
      const { data, error } = await supabase
        .from('alertas_whatsapp')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlertas((data as AlertaWhatsApp[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar alertas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar alertas WhatsApp",
        variant: "destructive",
      });
    }
  };

  // Carregar agendamentos
  const carregarAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos_whatsapp')
        .select(`
          *,
          alertas_whatsapp (
            id,
            nome,
            ativo
          )
        `)
        .order('proxima_execucao', { ascending: true });

      if (error) throw error;
      setAgendamentos((data as AgendamentoWhatsApp[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar agendamentos",
        variant: "destructive",
      });
    }
  };

  // Carregar histórico
  const carregarHistorico = async (limite = 100) => {
    try {
      const { data, error } = await supabase
        .from('historico_notificacoes_whatsapp')
        .select(`
          *,
          alertas_whatsapp (
            id,
            nome
          )
        `)
        .order('data_envio', { ascending: false })
        .limit(limite);

      if (error) throw error;
      setHistorico((data as any) || []);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de notificações",
        variant: "destructive",
      });
    }
  };

  // Criar alerta
  const criarAlerta = async (alerta: Omit<AlertaWhatsApp, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('alertas_whatsapp')
        .insert([alerta])
        .select()
        .single();

      if (error) throw error;

      setAlertas(prev => [data as AlertaWhatsApp, ...prev]);
      toast({
        title: "Sucesso",
        description: "Alerta WhatsApp criado com sucesso",
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao criar alerta:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar alerta WhatsApp",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Atualizar alerta
  const atualizarAlerta = async (id: string, updates: Partial<AlertaWhatsApp>) => {
    try {
      const { data, error } = await supabase
        .from('alertas_whatsapp')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setAlertas(prev => prev.map(a => a.id === id ? data as AlertaWhatsApp : a));
      toast({
        title: "Sucesso",
        description: "Alerta atualizado com sucesso",
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao atualizar alerta:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar alerta",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Duplicar alerta
  const duplicarAlerta = async (alertaOriginal: AlertaWhatsApp) => {
    try {
      const novoAlerta = {
        ...alertaOriginal,
        nome: `${alertaOriginal.nome} (Cópia)`,
        data_inicio: new Date().toISOString(),
      };
      
      // Remover campos que não devem ser duplicados
      delete (novoAlerta as any).id;
      delete (novoAlerta as any).created_at;
      delete (novoAlerta as any).updated_at;

      return await criarAlerta(novoAlerta);
    } catch (error: any) {
      console.error('Erro ao duplicar alerta:', error);
      throw error;
    }
  };

  // Excluir alerta
  const excluirAlerta = async (id: string) => {
    try {
      const { error } = await supabase
        .from('alertas_whatsapp')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlertas(prev => prev.filter(a => a.id !== id));
      toast({
        title: "Sucesso",
        description: "Alerta excluído com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao excluir alerta:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir alerta",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Reenviar mensagem
  const reenviarMensagem = async (historicoId: string) => {
    try {
      const notificacao = historico.find(h => h.id === historicoId);
      if (!notificacao) {
        throw new Error('Notificação não encontrada');
      }

      const response = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          alertaId: notificacao.alerta_id,
          numeroDestino: notificacao.numero_destino,
          mensagem: notificacao.mensagem_enviada,
          reenvio: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Sucesso",
        description: "Mensagem reenviada com sucesso",
      });

      // Recarregar histórico
      await carregarHistorico();
    } catch (error: any) {
      console.error('Erro ao reenviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao reenviar mensagem",
        variant: "destructive",
      });
    }
  };

  // Testar envio manual
  const testarEnvio = async (alertaId: string, numeroTeste: string) => {
    try {
      const alerta = alertas.find(a => a.id === alertaId);
      if (!alerta) {
        throw new Error('Alerta não encontrado');
      }

      const response = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          alertaId: alertaId,
          numeroDestino: numeroTeste,
          mensagem: alerta.mensagem
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Sucesso",
        description: "Mensagem de teste enviada com sucesso",
      });

      // Recarregar histórico
      await carregarHistorico();
    } catch (error: any) {
      console.error('Erro ao testar envio:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem de teste",
        variant: "destructive",
      });
    }
  };

  // Carregar dados inicial
  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      await Promise.all([
        carregarAlertas(),
        carregarAgendamentos(),
        carregarHistorico()
      ]);
      setLoading(false);
    };

    carregarDados();
  }, []);

  return {
    alertas,
    agendamentos,
    historico,
    loading,
    carregarAlertas,
    carregarAgendamentos,
    carregarHistorico,
    criarAlerta,
    atualizarAlerta,
    duplicarAlerta,
    excluirAlerta,
    reenviarMensagem,
    testarEnvio
  };
}