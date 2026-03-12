import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all feedback
    const { data: feedbacks, error } = await supabase
      .from("feedback_sistema")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!feedbacks || feedbacks.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum feedback encontrado para análise." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build summary for the AI
    const totalRespostas = feedbacks.length;
    
    const facilidadeCounts: Record<string, number> = {};
    const dificuldadeCounts: Record<string, number> = {};
    const satisfacaoModulos: Record<string, Record<string, number>> = {
      registro_ponto: {},
      prontuario: {},
      controle_temperatura: {},
      controle_fraldas: {},
      escala: {},
    };

    const textosAbertos = {
      processos_manuais: [] as string[],
      funcionalidades_desejadas: [] as string[],
      melhorias_sugeridas: [] as string[],
      sugestoes: [] as string[],
      criticas: [] as string[],
      elogios: [] as string[],
      observacoes_gerais: [] as string[],
    };

    for (const f of feedbacks) {
      facilidadeCounts[f.facilidade_uso] = (facilidadeCounts[f.facilidade_uso] || 0) + 1;
      dificuldadeCounts[f.dificuldade_ferramentas_digitais] = (dificuldadeCounts[f.dificuldade_ferramentas_digitais] || 0) + 1;

      const modFields = [
        { key: "registro_ponto", val: f.satisfacao_registro_ponto },
        { key: "prontuario", val: f.satisfacao_prontuario },
        { key: "controle_temperatura", val: f.satisfacao_controle_temperatura },
        { key: "controle_fraldas", val: f.satisfacao_controle_fraldas },
        { key: "escala", val: f.satisfacao_escala },
      ];
      for (const m of modFields) {
        if (m.val) satisfacaoModulos[m.key][m.val] = (satisfacaoModulos[m.key][m.val] || 0) + 1;
      }

      for (const key of Object.keys(textosAbertos) as (keyof typeof textosAbertos)[]) {
        const val = f[key];
        if (val && val.trim()) textosAbertos[key].push(`${f.funcionario_nome}: "${val}"`);
      }
    }

    const prompt = `Você é uma consultora especialista em gestão de ILPIs (Instituições de Longa Permanência para Idosos) e análise de sistemas de informação em saúde.

Analise os dados de feedback coletados de ${totalRespostas} funcionários sobre o sistema SENEXCARE e gere um RELATÓRIO CONSOLIDADO PROFISSIONAL.

## DADOS COLETADOS

### Facilidade de Uso do Sistema
${JSON.stringify(facilidadeCounts, null, 2)}

### Dificuldade com Ferramentas Digitais
${JSON.stringify(dificuldadeCounts, null, 2)}

### Satisfação por Módulo
${JSON.stringify(satisfacaoModulos, null, 2)}

### Processos ainda manuais relatados
${textosAbertos.processos_manuais.join("\n") || "Nenhum relato"}

### Funcionalidades desejadas
${textosAbertos.funcionalidades_desejadas.join("\n") || "Nenhum relato"}

### Melhorias sugeridas
${textosAbertos.melhorias_sugeridas.join("\n") || "Nenhum relato"}

### Sugestões
${textosAbertos.sugestoes.join("\n") || "Nenhum relato"}

### Críticas
${textosAbertos.criticas.join("\n") || "Nenhum relato"}

### Elogios
${textosAbertos.elogios.join("\n") || "Nenhum relato"}

### Observações gerais
${textosAbertos.observacoes_gerais.join("\n") || "Nenhum relato"}

## ESTRUTURA DO RELATÓRIO (siga rigorosamente)

1. **RESUMO EXECUTIVO** - Visão geral em 3-4 frases dos principais achados
2. **ANÁLISE DE USABILIDADE** - Interpretação dos dados de facilidade de uso e dificuldade digital, com percentuais
3. **SATISFAÇÃO POR MÓDULO** - Análise detalhada de cada módulo (Ponto, Prontuário, Temperatura, Fraldas, Escala), destacando os mais e menos bem avaliados
4. **PONTOS FORTES** - O que os funcionários mais valorizam no sistema (baseado em elogios e satisfação alta)
5. **PONTOS DE ATENÇÃO** - Problemas identificados e críticas recorrentes
6. **PROCESSOS MANUAIS PERSISTENTES** - Análise dos processos que ainda não foram digitalizados e impacto operacional
7. **RECOMENDAÇÕES PRIORITÁRIAS** - Lista ordenada por prioridade de ações sugeridas (curto, médio e longo prazo)
8. **PLANO DE AÇÃO SUGERIDO** - Tabela com ação, responsável sugerido, prazo e impacto esperado
9. **CONCLUSÃO** - Considerações finais e próximos passos

Use linguagem profissional, dados percentuais sempre que possível, e foque em insights acionáveis. Formate com Markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é uma consultora especialista em gestão de ILPIs e sistemas de saúde. Responda sempre em português brasileiro." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const relatorio = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ relatorio, total_respostas: totalRespostas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analisar-feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
