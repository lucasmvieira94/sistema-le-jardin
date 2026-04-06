import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dadosFuncionarios, mes, ano } = await req.json();

    if (!dadosFuncionarios || !Array.isArray(dadosFuncionarios) || dadosFuncionarios.length === 0) {
      return new Response(JSON.stringify({ error: 'Dados dos funcionários são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build concise summary for AI analysis
    const resumo = dadosFuncionarios.map((f: any) => {
      const diasComFalta = f.dados.filter((d: any) => d.faltas).map((d: any) => d.dia);
      const diasSemRegistro = f.dados.filter((d: any) => !d.entrada && !d.saida && !d.faltas && !d.abonos).map((d: any) => d.dia);
      const diasComHorasNoturnas = f.dados.filter((d: any) => d.horas_extras_noturnas && d.horas_extras_noturnas !== '00:00:00').map((d: any) => ({
        dia: d.dia,
        entrada: d.entrada,
        saida: d.saida,
        horas_noturnas: d.horas_extras_noturnas
      }));
      const diasSoComEntrada = f.dados.filter((d: any) => d.entrada && !d.saida).map((d: any) => d.dia);

      return {
        nome: f.dados[0]?.funcionario_nome,
        escala: f.dados[0]?.funcionario_escala_nome,
        escala_entrada: f.dados[0]?.funcionario_escala_entrada,
        escala_saida: f.dados[0]?.funcionario_escala_saida,
        total_faltas: f.totais.total_faltas,
        total_abonos: f.totais.total_abonos,
        dias_trabalhados: f.totais.dias_trabalhados,
        horas_trabalhadas: f.totais.total_horas_trabalhadas,
        horas_extras_diurnas: f.totais.total_horas_extras_diurnas,
        horas_extras_noturnas: f.totais.total_horas_extras_noturnas,
        dias_com_falta: diasComFalta,
        dias_sem_registro: diasSemRegistro,
        dias_com_horas_noturnas: diasComHorasNoturnas,
        dias_so_com_entrada: diasSoComEntrada
      };
    });

    const systemPrompt = `Você é um assistente especializado em análise de folha de ponto e legislação trabalhista brasileira (CLT).
Analise os dados da folha de ponto e identifique:

1. **Inconsistências em horas noturnas**: Verifique se funcionários com escalas noturnas (entrada após 22h ou saída antes de 5h) possuem horas noturnas corretamente calculadas. Se a escala indica turno noturno e horas_extras_noturnas está zerado, isso é uma inconsistência.

2. **Faltas não justificadas**: Dias marcados como falta sem nenhuma observação ou justificativa. Liste os dias e sugira que o gestor verifique se há justificativa pendente.

3. **Registros incompletos**: Dias com apenas entrada (sem saída) são problemas que precisam de correção manual.

4. **Excesso de horas extras**: Identifique funcionários com muitas horas extras que podem indicar sobrecarga.

5. **Padrões suspeitos**: Horários muito regulares podem indicar registros automáticos em vez de registros reais.

Responda em formato JSON com a estrutura:
{
  "analise_geral": "Resumo geral da análise",
  "alertas": [
    {
      "tipo": "inconsistencia_noturna|falta_injustificada|registro_incompleto|excesso_horas|padrao_suspeito",
      "severidade": "alta|media|baixa",
      "funcionario": "Nome do funcionário",
      "descricao": "Descrição detalhada",
      "dias_afetados": [1, 2, 3],
      "sugestao": "O que fazer para corrigir"
    }
  ],
  "recomendacoes": ["Lista de recomendações gerais"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise os dados da folha de ponto de ${mes}/${ano}:\n\n${JSON.stringify(resumo, null, 2)}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "relatorio_analise",
              description: "Retorna o relatório de análise da folha de ponto",
              parameters: {
                type: "object",
                properties: {
                  analise_geral: { type: "string", description: "Resumo geral da análise" },
                  alertas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string", enum: ["inconsistencia_noturna", "falta_injustificada", "registro_incompleto", "excesso_horas", "padrao_suspeito"] },
                        severidade: { type: "string", enum: ["alta", "media", "baixa"] },
                        funcionario: { type: "string" },
                        descricao: { type: "string" },
                        dias_afetados: { type: "array", items: { type: "number" } },
                        sugestao: { type: "string" }
                      },
                      required: ["tipo", "severidade", "funcionario", "descricao", "sugestao"]
                    }
                  },
                  recomendacoes: { type: "array", items: { type: "string" } }
                },
                required: ["analise_geral", "alertas", "recomendacoes"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "relatorio_analise" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao analisar dados com IA" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    
    let resultado;
    try {
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        resultado = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: parse from content
        const content = aiResponse.choices?.[0]?.message?.content || '{}';
        resultado = JSON.parse(content);
      }
    } catch {
      resultado = {
        analise_geral: aiResponse.choices?.[0]?.message?.content || 'Análise não disponível',
        alertas: [],
        recomendacoes: []
      };
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na análise:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
