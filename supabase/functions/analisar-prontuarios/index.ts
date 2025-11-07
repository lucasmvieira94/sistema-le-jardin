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

    const prompt = `Você é um assistente especializado em análise de registros de cuidados em instituições de longa permanência para idosos (ILPI).

Analise os dados fornecidos abaixo e gere um relatório semanal completo seguindo EXATAMENTE esta estrutura JSON:

{
  "resumo_executivo": "Resumo geral da semana em 3-5 frases destacando pontos principais",
  "metricas_gerais": {
    "total_prontuarios": número,
    "taxa_preenchimento": número (0-100),
    "residentes_atendidos": número,
    "funcionarios_ativos": número
  },
  "analise_detalhada": {
    "pontos_positivos": ["lista", "de", "pontos"],
    "areas_atencao": ["lista", "de", "areas"],
    "tendencias": ["lista", "de", "tendencias"]
  },
  "nao_conformidades": [
    {
      "tipo": "critico|atencao|informativo",
      "categoria": "medicamento|prontuario|fralda|temperatura|outros",
      "descricao": "descrição clara e objetiva",
      "residente_nome": "nome se aplicável ou null",
      "data_ocorrencia": "YYYY-MM-DD",
      "detalhes": {
        "contexto": "informações adicionais",
        "acao_recomendada": "o que fazer"
      }
    }
  ],
  "recomendacoes": ["lista", "de", "recomendações", "práticas"]
}

DADOS PARA ANÁLISE:
${JSON.stringify(contexto, null, 2)}

REGRAS IMPORTANTES:
1. Identifique padrões anormais (ex: medicação não administrada, prontuários incompletos, intervalos longos sem registros)
2. Classifique não conformidades por severidade
3. Seja objetivo e profissional
4. Foque em informações acionáveis
5. RETORNE APENAS O JSON, SEM TEXTO ADICIONAL`;

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