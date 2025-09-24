import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Processando agendamentos WhatsApp...');

    // Buscar agendamentos que devem ser executados agora
    const agora = new Date().toISOString();
    const { data: agendamentos, error: agendamentosError } = await supabaseClient
      .from('agendamentos_whatsapp')
      .select(`
        *,
        alertas_whatsapp (
          id,
          nome,
          mensagem,
          numeros_destino,
          frequencia_tipo,
          frequencia_valor,
          horario_especifico,
          ativo,
          mensagem_dinamica,
          timezone
        )
      `)
      .eq('status', 'agendado')
      .lte('proxima_execucao', agora)
      .limit(50); // Processar no máximo 50 agendamentos por vez

    if (agendamentosError) {
      throw new Error(`Erro ao buscar agendamentos: ${agendamentosError.message}`);
    }

    console.log(`Encontrados ${agendamentos?.length || 0} agendamentos para processar`);

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum agendamento para processar',
        processados: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processados = 0;
    let erros = 0;

    // Processar cada agendamento
    for (const agendamento of agendamentos) {
      try {
        const alerta = agendamento.alertas_whatsapp;
        
        // Verificar se o alerta ainda está ativo
        if (!alerta || !alerta.ativo) {
          console.log(`Pulando agendamento ${agendamento.id} - alerta inativo`);
          
          // Marcar agendamento como concluído
          await supabaseClient
            .from('agendamentos_whatsapp')
            .update({ status: 'erro', updated_at: new Date().toISOString() })
            .eq('id', agendamento.id);
          
          continue;
        }

        // Marcar agendamento como em execução
        await supabaseClient
          .from('agendamentos_whatsapp')
          .update({ status: 'executando', updated_at: new Date().toISOString() })
          .eq('id', agendamento.id);

        // Enviar mensagem para cada número de destino
        const numerosPendentes = [];
        for (const numero of alerta.numeros_destino) {
          try {
            // Chamar a edge function de envio de WhatsApp
            const envioResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-whatsapp`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                alertaId: alerta.id,
                numeroDestino: numero,
                mensagem: alerta.mensagem,
                agendamentoId: agendamento.id,
                reenvio: false
              })
            });

            const envioResult = await envioResponse.json();
            
            if (!envioResult.success) {
              console.error(`Erro ao enviar para ${numero}:`, envioResult.error);
              numerosPendentes.push(numero);
            } else {
              console.log(`Mensagem enviada com sucesso para ${numero}`);
            }

            // Pequena pausa entre envios para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (envioError) {
            console.error(`Erro no envio para ${numero}:`, envioError);
            numerosPendentes.push(numero);
          }
        }

        // Calcular próxima execução se o alerta deve continuar
        const { data: proximaExecucao, error: proximaExecucaoError } = await supabaseClient
          .rpc('calcular_proxima_execucao', {
            p_frequencia_tipo: alerta.frequencia_tipo,
            p_frequencia_valor: alerta.frequencia_valor,
            p_horario_especifico: alerta.horario_especifico,
            p_data_base: new Date().toISOString(),
            p_timezone: alerta.timezone || 'America/Sao_Paulo'
          });

        if (proximaExecucaoError) {
          console.error('Erro ao calcular próxima execução:', proximaExecucaoError);
        }

        // Atualizar agendamento
        if (numerosPendentes.length === 0) {
          // Todos os envios foram bem-sucedidos
          if (proximaExecucao && !proximaExecucaoError) {
            // Reagendar para próxima execução
            await supabaseClient
              .from('agendamentos_whatsapp')
              .update({
                status: 'agendado',
                proxima_execucao: proximaExecucao,
                tentativas: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', agendamento.id);
          } else {
            // Marcar como concluído
            await supabaseClient
              .from('agendamentos_whatsapp')
              .update({ status: 'concluido', updated_at: new Date().toISOString() })
              .eq('id', agendamento.id);
          }
        } else {
          // Alguns envios falharam, marcar como erro
          await supabaseClient
            .from('agendamentos_whatsapp')
            .update({
              status: 'erro',
              tentativas: agendamento.tentativas + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', agendamento.id);
        }

        processados++;

      } catch (error) {
        console.error(`Erro ao processar agendamento ${agendamento.id}:`, error);
        erros++;
        
        // Marcar agendamento como erro
        await supabaseClient
          .from('agendamentos_whatsapp')
          .update({
            status: 'erro',
            tentativas: agendamento.tentativas + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', agendamento.id);
      }
    }

    console.log(`Processamento concluído: ${processados} processados, ${erros} erros`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processados ${processados} agendamentos com ${erros} erros`,
      processados,
      erros
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro geral no processamento de agendamentos:', error);

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