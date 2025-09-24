import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ConversaWhatsApp {
  id: string;
  numero_whatsapp: string;
  nome_contato?: string;
  ultima_mensagem?: string;
  ultima_atividade: string;
  status: 'ativa' | 'pausada' | 'arquivada';
  mensagens_nao_lidas: number;
  created_at: string;
  updated_at: string;
}

export interface MensagemWhatsApp {
  id: string;
  conversa_id: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento' | 'localizacao';
  direcao: 'enviada' | 'recebida';
  remetente?: string;
  whatsapp_message_id?: string;
  status: 'enviada' | 'entregue' | 'lida' | 'falhou';
  metadata?: any;
  created_at: string;
}

export interface MensagemPredefinida {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  ativo: boolean;
  ordem: number;
}

export interface ConsultaIA {
  id: string;
  pergunta: string;
  resposta?: string;
  usuario_id?: string;
  conversa_id?: string;
  status: 'processando' | 'concluida' | 'erro';
  tempo_resposta?: number;
  metadata?: any;
  created_at: string;
}

export function useWhatsAppConversas() {
  const [conversas, setConversas] = useState<ConversaWhatsApp[]>([]);
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [mensagensPredefinidas, setMensagensPredefinidas] = useState<MensagemPredefinida[]>([]);
  const [consultasIA, setConsultasIA] = useState<ConsultaIA[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<ConversaWhatsApp | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Carregar conversas
  const carregarConversas = async () => {
    try {
      const { data, error } = await supabase
        .from('conversas_whatsapp')
        .select('*')
        .order('ultima_atividade', { ascending: false });

      if (error) throw error;
      setConversas((data as ConversaWhatsApp[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar conversas WhatsApp",
        variant: "destructive",
      });
    }
  };

  // Carregar mensagens de uma conversa
  const carregarMensagens = async (conversaId: string) => {
    try {
      const { data, error } = await supabase
        .from('mensagens_whatsapp')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMensagens((data as MensagemWhatsApp[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar mensagens",
        variant: "destructive",
      });
    }
  };

  // Carregar mensagens predefinidas
  const carregarMensagensPredefinidas = async () => {
    try {
      const { data, error } = await supabase
        .from('mensagens_predefinidas_whatsapp')
        .select('*')
        .eq('ativo', true)
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });

      if (error) throw error;
      setMensagensPredefinidas((data as MensagemPredefinida[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar mensagens predefinidas:', error);
    }
  };

  // Enviar mensagem manual
  const enviarMensagem = async (numeroDestino: string, mensagem: string, conversaId?: string) => {
    try {
      // Se não existe conversa, criar uma nova
      let conversa = conversaId ? 
        conversas.find(c => c.id === conversaId) : 
        conversas.find(c => c.numero_whatsapp === numeroDestino);

      if (!conversa) {
        const { data: novaConversa, error: conversaError } = await supabase
          .from('conversas_whatsapp')
          .insert([{
            numero_whatsapp: numeroDestino,
            nome_contato: numeroDestino,
            status: 'ativa'
          }])
          .select()
          .single();

        if (conversaError) throw conversaError;
        conversa = novaConversa as ConversaWhatsApp;
        setConversas(prev => [novaConversa as ConversaWhatsApp, ...prev]);
      }

      // Registrar mensagem no banco
      const { error: mensagemError } = await supabase
        .from('mensagens_whatsapp')
        .insert([{
          conversa_id: conversa.id,
          conteudo: mensagem,
          direcao: 'enviada',
          remetente: 'sistema'
        }]);

      if (mensagemError) throw mensagemError;

      // Enviar via WhatsApp
      const response = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numeroDestino,
          mensagem,
          conversaId: conversa.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso",
      });

      // Recarregar dados
      await carregarConversas();
      if (conversaSelecionada?.id === conversa.id) {
        await carregarMensagens(conversa.id);
      }

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Consultar IA
  const consultarIA = async (pergunta: string, conversaId?: string) => {
    try {
      const consultaData = {
        pergunta,
        conversa_id: conversaId,
        status: 'processando' as const
      };

      const { data: consulta, error } = await supabase
        .from('consultas_ia_whatsapp')
        .insert([consultaData])
        .select()
        .single();

      if (error) throw error;

      setConsultasIA(prev => [consulta as ConsultaIA, ...prev]);

      // Simular processamento da IA (aqui você integraria com OpenAI ou outro serviço)
      setTimeout(async () => {
        const respostaSimulada = `Resposta da IA para: ${pergunta}`;
        
        await supabase
          .from('consultas_ia_whatsapp')
          .update({
            resposta: respostaSimulada,
            status: 'concluida',
            tempo_resposta: 1500
          })
          .eq('id', consulta.id);

        setConsultasIA(prev => prev.map(c => 
          c.id === consulta.id 
            ? { ...c, resposta: respostaSimulada, status: 'concluida' as const }
            : c
        ));
      }, 2000);

      return consulta;
    } catch (error: any) {
      console.error('Erro ao consultar IA:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao consultar IA",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Criar nova conversa
  const criarConversa = async (numeroWhatsApp: string, nomeContato?: string) => {
    try {
      const { data, error } = await supabase
        .from('conversas_whatsapp')
        .insert([{
          numero_whatsapp: numeroWhatsApp,
          nome_contato: nomeContato || numeroWhatsApp,
          status: 'ativa'
        }])
        .select()
        .single();

      if (error) throw error;

      setConversas(prev => [data as ConversaWhatsApp, ...prev]);
      return data;
    } catch (error: any) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar conversa",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Buscar conversas
  const buscarConversas = async (termo: string) => {
    try {
      const { data, error } = await supabase
        .from('conversas_whatsapp')
        .select('*')
        .or(`numero_whatsapp.ilike.%${termo}%,nome_contato.ilike.%${termo}%,ultima_mensagem.ilike.%${termo}%`)
        .order('ultima_atividade', { ascending: false });

      if (error) throw error;
      setConversas((data as ConversaWhatsApp[]) || []);
    } catch (error: any) {
      console.error('Erro ao buscar conversas:', error);
    }
  };

  // Marcar conversa como lida
  const marcarComoLida = async (conversaId: string) => {
    try {
      const { error } = await supabase
        .from('conversas_whatsapp')
        .update({ mensagens_nao_lidas: 0 })
        .eq('id', conversaId);

      if (error) throw error;

      setConversas(prev => prev.map(c => 
        c.id === conversaId ? { ...c, mensagens_nao_lidas: 0 } : c
      ));
    } catch (error: any) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  // Obter métricas do dashboard
  const obterMetricas = async () => {
    try {
      const [conversasAtivas, mensagensEnviadas, consultasIA] = await Promise.all([
        supabase.from('conversas_whatsapp').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
        supabase.from('mensagens_whatsapp').select('id', { count: 'exact', head: true }).eq('direcao', 'enviada'),
        supabase.from('consultas_ia_whatsapp').select('id', { count: 'exact', head: true }).eq('status', 'concluida')
      ]);

      return {
        conversasAtivas: conversasAtivas.count || 0,
        mensagensEnviadas: mensagensEnviadas.count || 0,
        consultasIA: consultasIA.count || 0
      };
    } catch (error: any) {
      console.error('Erro ao obter métricas:', error);
      return { conversasAtivas: 0, mensagensEnviadas: 0, consultasIA: 0 };
    }
  };

  // Carregar dados inicial
  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      await Promise.all([
        carregarConversas(),
        carregarMensagensPredefinidas()
      ]);
      setLoading(false);
    };

    carregarDados();
  }, []);

  // Carregar mensagens quando conversa é selecionada
  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      marcarComoLida(conversaSelecionada.id);
    } else {
      setMensagens([]);
    }
  }, [conversaSelecionada]);

  return {
    conversas,
    mensagens,
    mensagensPredefinidas,
    consultasIA,
    conversaSelecionada,
    loading,
    setConversaSelecionada,
    carregarConversas,
    carregarMensagens,
    enviarMensagem,
    consultarIA,
    criarConversa,
    buscarConversas,
    marcarComoLida,
    obterMetricas
  };
}