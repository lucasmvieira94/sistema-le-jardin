import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicio, dataFim, tenantId } = await req.json();
    
    console.log('Iniciando análise de prontuários:', { dataInicio, dataFim, tenantId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar prontuários do período
    const { data: prontuarios, error: prontuariosError } = await supabase
      .from('prontuario_registros')
      .select(`
        *,
        residente:residentes(nome_completo, numero_prontuario),
        funcionario:funcionarios(nome_completo, funcao),
        ciclo:prontuario_ciclos(data_ciclo, status)
      `)
      .gte('data_registro', dataInicio)
      .lte('data_registro', dataFim)
      .order('data_registro', { ascending: false });

    if (prontuariosError) {
      console.error('Erro ao buscar prontuários:', prontuariosError);
      throw prontuariosError;
    }

    console.log(`${prontuarios?.length || 0} prontuários encontrados`);

    // Buscar medicamentos administrados
    const { data: medicamentos, error: medicamentosError } = await supabase
      .from('administracao_medicamentos')
      .select(`
        *,
        medicamento:medicamentos(nome, controlado),
        residente:residentes(nome_completo)
      `)
      .gte('data_administracao', dataInicio)
      .lte('data_administracao', dataFim);

    if (medicamentosError) {
      console.error('Erro ao buscar medicamentos:', medicamentosError);
    }

    // Buscar fraldas
    const { data: fraldas, error: fraldasError } = await supabase
      .from('uso_fraldas')
      .select('*')
      .gte('data_uso', dataInicio)
      .lte('data_uso', dataFim);

    if (fraldasError) {
      console.error('Erro ao buscar fraldas:', fraldasError);
    }

    // Montar contexto para a IA
    const contexto = {
      periodo: { inicio: dataInicio, fim: dataFim },
      estatisticas: {
        total_prontuarios: prontuarios?.length || 0,
        total_medicamentos: medicamentos?.length || 0,
        total_fraldas: fraldas?.length || 0,
      },
      prontuarios: prontuarios?.slice(0, 100), // Limitar para não exceder token limit
      medicamentos: medicamentos?.slice(0, 50),
      fraldas: fraldas?.slice(0, 50),
    };

    const prompt = `Você é uma cuidadora experiente de idosos com mais de 15 anos de experiência em instituições de longa permanência (ILPI). Sua missão é analisar os registros de cuidados com o olhar atento e empático de quem conhece profundamente as necessidades dos residentes.

PERSPECTIVA DE ANÁLISE:
- Identifique mudanças sutis no comportamento, saúde e bem-estar dos residentes
- Antecipe possíveis problemas futuros baseando-se em padrões observados
- Destaque SEMPRE as observações registradas pelos cuidadores - elas são cruciais
- Proponha soluções práticas e viáveis para a equipe de cuidados
- Considere o contexto humano por trás dos números (cada dado representa um idoso sob cuidados)

Analise os dados fornecidos abaixo e gere um relatório semanal completo seguindo EXATAMENTE esta estrutura JSON:

{
  "resumo_executivo": "Resumo geral da semana em 3-5 frases destacando pontos principais com foco em alterações e tendências observadas",
  "metricas_gerais": {
    "total_prontuarios": número,
    "taxa_preenchimento": número (0-100),
    "residentes_atendidos": número,
    "funcionarios_ativos": número
  },
  "analise_detalhada": {
    "pontos_positivos": ["lista de aspectos positivos observados no cuidado"],
    "areas_atencao": ["lista de áreas que necessitam atenção imediata ou monitoramento"],
    "tendencias": ["lista de tendências e padrões identificados que podem indicar problemas futuros"],
    "observacoes_destaque": ["SEMPRE incluir aqui as observações importantes registradas pelos cuidadores"]
  },
  "nao_conformidades": [
    {
      "tipo": "critico|atencao|informativo",
      "categoria": "medicamento|prontuario|fralda|temperatura|outros",
      "descricao": "descrição clara e objetiva do ponto de vista de uma cuidadora",
      "residente_nome": "nome se aplicável ou null",
      "data_ocorrencia": "YYYY-MM-DD",
      "impacto_potencial": "explicação do que isso pode causar ao residente",
      "detalhes": {
        "contexto": "informações adicionais sobre a situação",
        "acao_recomendada": "ação prática e específica que a equipe deve tomar",
        "prazo_acao": "urgente|curto prazo|médio prazo"
      }
    }
  ],
  "solucoes_melhorias": [
    {
      "area": "área específica (medicação, higiene, alimentação, etc)",
      "problema_identificado": "descrição do problema",
      "solucao_proposta": "solução prática e detalhada",
      "beneficio_esperado": "impacto positivo esperado"
    }
  ],
  "recomendacoes": ["lista de recomendações práticas para melhoria contínua do cuidado"]
}

DADOS PARA ANÁLISE:
${JSON.stringify(contexto, null, 2)}

REGRAS IMPORTANTES PARA SUA ANÁLISE:
1. SEMPRE destaque as observações escritas pelos cuidadores - elas contêm informações valiosas sobre o estado do residente
2. Identifique mudanças de padrão (ex: residente que sempre se alimenta bem mas está recusando refeições, alterações no sono, mudanças de humor)
3. Antecipe riscos (ex: quedas, desidratação, infecções, piora de quadros clínicos)
4. Classifique não conformidades pensando no impacto direto ao residente
5. Proponha soluções que sejam viáveis para a equipe implementar no dia a dia
6. Considere o histórico e contexto de cada residente quando disponível
7. Seja empática mas profissional, focando sempre no bem-estar dos idosos
8. RETORNE APENAS O JSON, SEM TEXTO ADICIONAL`;

    console.log('Chamando IA para análise...');

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos em Settings -> Workspace -> Usage.');
      }
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analiseTexto = aiData.choices[0].message.content;
    
    console.log('Análise recebida da IA');

    // Parse do JSON retornado
    let analise;
    try {
      // Remover markdown code blocks se existirem
      const jsonText = analiseTexto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analise = JSON.parse(jsonText);
    } catch (e) {
      console.error('Erro ao fazer parse da resposta:', e);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }

    // Salvar relatório
    const { data: relatorio, error: relatorioError } = await supabase
      .from('relatorios_semanais_ia')
      .insert({
        tenant_id: tenantId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        relatorio: analise,
        resumo_executivo: analise.resumo_executivo,
        total_prontuarios: contexto.estatisticas.total_prontuarios,
        nao_conformidades_encontradas: analise.nao_conformidades?.length || 0,
      })
      .select()
      .single();

    if (relatorioError) {
      console.error('Erro ao salvar relatório:', relatorioError);
      throw relatorioError;
    }

    console.log('Relatório salvo:', relatorio.id);

    // Salvar não conformidades como alertas
    if (analise.nao_conformidades && analise.nao_conformidades.length > 0) {
      const alertas = analise.nao_conformidades.map((nc: any) => ({
        tenant_id: tenantId,
        relatorio_id: relatorio.id,
        residente_id: null, // Pode ser preenchido se conseguirmos mapear o nome
        tipo_alerta: nc.tipo,
        categoria: nc.categoria,
        descricao: nc.descricao,
        detalhes: nc.detalhes,
        data_ocorrencia: nc.data_ocorrencia,
        status: 'pendente',
      }));

      const { error: alertasError } = await supabase
        .from('alertas_nao_conformidade')
        .insert(alertas);

      if (alertasError) {
        console.error('Erro ao salvar alertas:', alertasError);
      } else {
        console.log(`${alertas.length} alertas salvos`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        mensagem: 'Análise concluída com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao processar análise' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});