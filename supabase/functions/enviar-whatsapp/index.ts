import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para enviar mensagem via Twilio WhatsApp API usando template
async function enviarMensagemWhatsApp(numero: string, mensagem: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

  console.log('Verificando credenciais Twilio...');
  console.log('TWILIO_ACCOUNT_SID:', accountSid ? `${accountSid.substring(0, 10)}...` : 'NÃO CONFIGURADO');
  console.log('TWILIO_AUTH_TOKEN:', authToken ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
  console.log('TWILIO_WHATSAPP_NUMBER:', twilioWhatsAppNumber ? twilioWhatsAppNumber : 'NÃO CONFIGURADO');

  if (!accountSid || !authToken || !twilioWhatsAppNumber) {
    throw new Error('Credenciais do Twilio não configuradas. Verifique: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_NUMBER');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  // Garantir que estamos usando apenas ContentSid e ContentVariables para mensagens de template
  // NUNCA usar Body para mensagens iniciadas pelo negócio após abril 2025
  const body = new URLSearchParams();
  body.append('From', `whatsapp:${twilioWhatsAppNumber}`);
  body.append('To', `whatsapp:${numero}`);
  body.append('ContentSid', 'HX333047c068881b30f385de9e9fce1957');
  body.append('ContentVariables', JSON.stringify({"1": mensagem}));
  
  console.log('Enviando mensagem WhatsApp como template com ContentSid...');
  console.log('ContentVariables:', JSON.stringify({"1": mensagem}));

  console.log('Enviando para Twilio com body:', body.toString());
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString()
  });

  const result = await response.json();
  console.log('Resposta do Twilio:', JSON.stringify(result));
  
  if (!response.ok) {
    console.error('Erro do Twilio - Status:', response.status);
    console.error('Erro do Twilio - Response:', JSON.stringify(result));
    throw new Error(`Erro do Twilio (${response.status}): ${result.message || result.code || 'Erro desconhecido'} - ${JSON.stringify(result)}`);
  }

  return result;
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
      alertaId, 
      numeroDestino, 
      mensagem, 
      agendamentoId,
      reenvio = false 
    } = await req.json();

    console.log('Enviando WhatsApp:', { alertaId, numeroDestino, agendamentoId, reenvio });

    // Validar entrada
    if (!numeroDestino || !mensagem) {
      throw new Error('Número de destino e mensagem são obrigatórios');
    }

    let mensagemProcessada = mensagem;

    // Se for um alerta agendado, buscar dados do alerta para processar mensagem dinâmica
    if (alertaId) {
      const { data: alerta, error: alertaError } = await supabaseClient
        .from('alertas_whatsapp')
        .select('*')
        .eq('id', alertaId)
        .single();

      if (alertaError) {
        throw new Error(`Erro ao buscar alerta: ${alertaError.message}`);
      }

      // Processar mensagem dinâmica se necessário
      if (alerta.mensagem_dinamica) {
        const { data: mensagemDinamica, error: processError } = await supabaseClient
          .rpc('processar_mensagem_dinamica', {
            p_mensagem: mensagem,
            p_timezone: alerta.timezone || 'America/Sao_Paulo'
          });

        if (processError) {
          console.error('Erro ao processar mensagem dinâmica:', processError);
          mensagemProcessada = mensagem; // Usar mensagem original se houver erro
        } else {
          mensagemProcessada = mensagemDinamica;
        }
      }
    }

    // Tentar enviar mensagem
    const resultado = await enviarMensagemWhatsApp(numeroDestino, mensagemProcessada);

    // Registrar no histórico
    const { error: historicoError } = await supabaseClient
      .from('historico_notificacoes_whatsapp')
      .insert({
        alerta_id: alertaId,
        agendamento_id: agendamentoId,
        numero_destino: numeroDestino,
        mensagem_enviada: mensagemProcessada,
        status: 'enviado',
        whatsapp_message_id: resultado.sid,
        tentativa_numero: reenvio ? 2 : 1
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
    }

    // Se for um agendamento, atualizar status
    if (agendamentoId) {
      const { error: agendamentoError } = await supabaseClient
        .from('agendamentos_whatsapp')
        .update({ 
          status: 'concluido',
          updated_at: new Date().toISOString()
        })
        .eq('id', agendamentoId);

      if (agendamentoError) {
        console.error('Erro ao atualizar agendamento:', agendamentoError);
      }
    }

    console.log('WhatsApp enviado com sucesso:', resultado.sid);

    return new Response(JSON.stringify({
      success: true,
      messageId: resultado.sid,
      status: resultado.status
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro ao enviar WhatsApp:', error);

    // Registrar erro no histórico se temos os dados necessários
    try {
      const body = await req.clone().json();
      const { alertaId, numeroDestino, mensagem, agendamentoId, reenvio } = body;

      if (alertaId && numeroDestino && mensagem) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('historico_notificacoes_whatsapp')
          .insert({
            alerta_id: alertaId,
            agendamento_id: agendamentoId,
            numero_destino: numeroDestino,
            mensagem_enviada: mensagem,
            status: 'erro',
            erro_descricao: error.message,
            tentativa_numero: reenvio ? 2 : 1
          });

        // Atualizar agendamento como erro se aplicável
        if (agendamentoId) {
          await supabaseClient
            .from('agendamentos_whatsapp')
            .update({ 
              status: 'erro',
              tentativas: 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', agendamentoId);
        }
      }
    } catch (registroError) {
      console.error('Erro ao registrar erro no histórico:', registroError);
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