import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para consultar IA (simulação - pode integrar com OpenAI, Claude, etc.)
async function processarConsultaIA(pergunta: string, contexto?: any) {
  // Aqui você integraria com sua API de IA preferida
  // Por enquanto, vamos simular uma resposta baseada na pergunta
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simular processamento
  
  let resposta = '';
  
  if (pergunta.toLowerCase().includes('funcionários') || pergunta.toLowerCase().includes('funcionario')) {
    resposta = 'Com base nos dados do sistema, temos funcionários ativos cadastrados. Para informações específicas, consulte o módulo de Funcionários.';
  } else if (pergunta.toLowerCase().includes('medicamentos') || pergunta.toLowerCase().includes('medicamento')) {
    resposta = 'O sistema possui controle de medicamentos com estoque e administração. Verifique o módulo de Controle de Medicamentos para detalhes.';
  } else if (pergunta.toLowerCase().includes('residentes') || pergunta.toLowerCase().includes('residente')) {
    resposta = 'Há residentes cadastrados no sistema com seus respectivos prontuários. Consulte o módulo de Residentes para mais informações.';
  } else if (pergunta.toLowerCase().includes('temperatura')) {
    resposta = 'O sistema monitora a temperatura de medicamentos conforme regulamentações. Verifique o módulo de Controle de Temperatura.';
  } else if (pergunta.toLowerCase().includes('prontuário') || pergunta.toLowerCase().includes('prontuario')) {
    resposta = 'O sistema gerencia prontuários eletrônicos com ciclos diários. Acesse o Controle de Prontuários para mais detalhes.';
  } else {
    resposta = `Recebi sua consulta: "${pergunta}". Como assistente virtual integrado ao SenexCare, posso ajudar com informações sobre funcionários, residentes, medicamentos, prontuários e controle de temperatura. Como posso ser mais específico em sua consulta?`;
  }
  
  return resposta;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      consultaId,
      pergunta,
      conversaId,
      usuarioId
    } = await req.json();

    console.log('Processando consulta IA:', { consultaId, pergunta, conversaId });

    // Validar entrada
    if (!consultaId || !pergunta) {
      throw new Error('ID da consulta e pergunta são obrigatórios');
    }

    const inicioProcessamento = Date.now();

    // Processar consulta com IA
    const resposta = await processarConsultaIA(pergunta, { conversaId, usuarioId });

    const tempoResposta = Date.now() - inicioProcessamento;

    // Atualizar consulta no banco de dados
    const { error: updateError } = await supabaseClient
      .from('consultas_ia_whatsapp')
      .update({
        resposta: resposta,
        status: 'concluida',
        tempo_resposta: tempoResposta
      })
      .eq('id', consultaId);

    if (updateError) {
      throw new Error(`Erro ao atualizar consulta: ${updateError.message}`);
    }

    // Se há uma conversa associada, adicionar a resposta como mensagem
    if (conversaId) {
      const { error: mensagemError } = await supabaseClient
        .from('mensagens_whatsapp')
        .insert({
          conversa_id: conversaId,
          conteudo: resposta,
          direcao: 'enviada',
          remetente: 'ia',
          tipo: 'texto',
          status: 'enviada'
        });

      if (mensagemError) {
        console.error('Erro ao inserir mensagem da IA:', mensagemError);
      }
    }

    console.log('Consulta IA processada com sucesso:', consultaId);

    return new Response(JSON.stringify({
      success: true,
      consultaId: consultaId,
      resposta: resposta,
      tempoResposta: tempoResposta
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro ao processar consulta IA:', error);

    // Tentar atualizar status de erro no banco se temos o ID
    try {
      const body = await req.clone().json();
      const { consultaId } = body;

      if (consultaId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('consultas_ia_whatsapp')
          .update({
            status: 'erro',
            resposta: `Erro ao processar consulta: ${error.message}`
          })
          .eq('id', consultaId);
      }
    } catch (registroError) {
      console.error('Erro ao registrar erro da consulta:', registroError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);