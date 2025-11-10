import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Agendamento {
  id: string;
  tenant_id: string;
  dia_semana: number;
  hora: string;
  periodo_dias: number;
  email_destinatario: string;
  nome_destinatario: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando processamento de agendamentos de relatórios...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter data e hora atual no fuso horário do Brasil
    const agora = new Date();
    const agoraBrasil = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaSemanaAtual = agoraBrasil.getDay(); // 0=domingo, 6=sábado
    const horaAtual = agoraBrasil.getHours();
    const minutoAtual = agoraBrasil.getMinutes();

    console.log(`Data/Hora Brasil: ${agoraBrasil.toLocaleString()}`);
    console.log(`Dia da semana: ${diaSemanaAtual}, Hora: ${horaAtual}:${minutoAtual}`);

    // Buscar agendamentos ativos para o dia da semana atual
    const { data: agendamentos, error: agendamentosError } = await supabase
      .from("agendamentos_relatorios_ia")
      .select("*")
      .eq("ativo", true)
      .eq("dia_semana", diaSemanaAtual);

    if (agendamentosError) {
      console.error("Erro ao buscar agendamentos:", agendamentosError);
      throw agendamentosError;
    }

    console.log(`Encontrados ${agendamentos?.length || 0} agendamentos para hoje`);

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "Nenhum agendamento encontrado para hoje",
          dia_semana: diaSemanaAtual,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const resultados = [];

    // Processar cada agendamento
    for (const agendamento of agendamentos as Agendamento[]) {
      try {
        // Verificar se está na hora correta (com margem de ±30 minutos)
        const [horaAgendada, minutoAgendado] = agendamento.hora.split(":").map(Number);
        const diferencaMinutos = Math.abs((horaAtual * 60 + minutoAtual) - (horaAgendada * 60 + minutoAgendado));

        console.log(`Agendamento ${agendamento.id}: Hora agendada ${horaAgendada}:${minutoAgendado}, diferença: ${diferencaMinutos}min`);

        // Executar apenas se estiver dentro da janela de 30 minutos
        if (diferencaMinutos > 30) {
          console.log(`Fora da janela de execução. Pulando...`);
          continue;
        }

        console.log(`Processando agendamento ${agendamento.id} para tenant ${agendamento.tenant_id}`);

        // Calcular período de análise
        const dataFim = new Date(agoraBrasil);
        dataFim.setHours(0, 0, 0, 0);
        const dataInicio = new Date(dataFim);
        dataInicio.setDate(dataInicio.getDate() - agendamento.periodo_dias);

        const dataInicioStr = dataInicio.toISOString().split("T")[0];
        const dataFimStr = dataFim.toISOString().split("T")[0];

        console.log(`Gerando relatório para período: ${dataInicioStr} a ${dataFimStr}`);

        // Chamar função de análise de prontuários
        const { data: relatorioData, error: relatorioError } = await supabase.functions.invoke(
          "analisar-prontuarios",
          {
            body: {
              dataInicio: dataInicioStr,
              dataFim: dataFimStr,
              tenantId: agendamento.tenant_id,
            },
          }
        );

        if (relatorioError) {
          console.error(`Erro ao gerar relatório para agendamento ${agendamento.id}:`, relatorioError);
          resultados.push({
            agendamento_id: agendamento.id,
            tenant_id: agendamento.tenant_id,
            sucesso: false,
            erro: relatorioError.message,
          });
          continue;
        }

        console.log(`Relatório gerado com sucesso para agendamento ${agendamento.id}`);

        // Buscar o relatório recém criado
        const { data: relatorio, error: relatorioGetError } = await supabase
          .from("relatorios_semanais_ia")
          .select("*")
          .eq("tenant_id", agendamento.tenant_id)
          .eq("data_inicio", dataInicioStr)
          .eq("data_fim", dataFimStr)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (relatorioGetError || !relatorio) {
          console.error(`Erro ao buscar relatório criado:`, relatorioGetError);
          resultados.push({
            agendamento_id: agendamento.id,
            tenant_id: agendamento.tenant_id,
            sucesso: false,
            erro: "Relatório gerado mas não encontrado no banco",
          });
          continue;
        }

        // Gerar PDF do relatório (simplificado - apenas metadados)
        const pdfContent = btoa(JSON.stringify({
          titulo: "Relatório Semanal com IA",
          periodo: `${dataInicioStr} a ${dataFimStr}`,
          resumo: relatorio.resumo_executivo,
          metricas: {
            total_prontuarios: relatorio.total_prontuarios,
            nao_conformidades: relatorio.nao_conformidades_encontradas,
          },
        }));

        // Enviar email com o relatório
        const { error: emailError } = await supabase.functions.invoke("enviar-relatorio-email", {
          body: {
            emailGestor: agendamento.email_destinatario,
            nomeGestor: agendamento.nome_destinatario,
            relatorio: relatorio,
            pdfBase64: pdfContent,
          },
        });

        if (emailError) {
          console.error(`Erro ao enviar email para agendamento ${agendamento.id}:`, emailError);
          resultados.push({
            agendamento_id: agendamento.id,
            tenant_id: agendamento.tenant_id,
            sucesso: false,
            erro: `Relatório gerado mas email falhou: ${emailError.message}`,
          });
          continue;
        }

        console.log(`Email enviado com sucesso para ${agendamento.email_destinatario}`);

        resultados.push({
          agendamento_id: agendamento.id,
          tenant_id: agendamento.tenant_id,
          email: agendamento.email_destinatario,
          sucesso: true,
          periodo: `${dataInicioStr} a ${dataFimStr}`,
        });
      } catch (error: any) {
        console.error(`Erro ao processar agendamento ${agendamento.id}:`, error);
        resultados.push({
          agendamento_id: agendamento.id,
          tenant_id: agendamento.tenant_id,
          sucesso: false,
          erro: error.message,
        });
      }
    }

    console.log("Processamento concluído:", resultados);

    return new Response(
      JSON.stringify({
        message: "Processamento concluído",
        total_agendamentos: agendamentos.length,
        resultados,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro geral no processamento:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
