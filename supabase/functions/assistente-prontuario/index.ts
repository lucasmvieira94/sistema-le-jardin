import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, residenteId, funcionarioId, acao } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar contexto do residente
    let contextoResidente = '';
    if (residenteId) {
      const { data: residente } = await supabase
        .from('residentes')
        .select('nome_completo, data_nascimento, condicoes_medicas, observacoes_gerais, quarto')
        .eq('id', residenteId)
        .single();

      // Buscar últimos 7 dias de prontuários
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 7);

      const { data: prontuariosRecentes } = await supabase
        .from('prontuario_registros')
        .select('descricao, data_registro, tipo_registro, horario_registro')
        .eq('residente_id', residenteId)
        .eq('tipo_registro', 'prontuario_completo')
        .gte('data_registro', dataLimite.toISOString().split('T')[0])
        .order('data_registro', { ascending: false })
        .limit(7);

      // Buscar campos configurados do formulário
      const { data: camposConfig } = await supabase
        .from('formulario_campos_config')
        .select('id, label, secao, tipo, obrigatorio')
        .eq('ativo', true)
        .order('secao, ordem');

      // Buscar medicamentos administrados recentes
      const { data: medicamentosRecentes } = await supabase
        .from('administracao_medicamentos')
        .select(`
          data_administracao, horario_administracao, dosagem_administrada, observacoes,
          medicamento:medicamentos(nome, dosagem, controlado)
        `)
        .eq('residente_id', residenteId)
        .gte('data_administracao', dataLimite.toISOString().split('T')[0])
        .order('data_administracao', { ascending: false })
        .limit(20);

      // Buscar ciclo de hoje
      const hoje = new Date().toISOString().split('T')[0];
      const { data: cicloHoje } = await supabase
        .from('prontuario_ciclos')
        .select('id, status, data_inicio_efetivo')
        .eq('residente_id', residenteId)
        .eq('data_ciclo', hoje)
        .maybeSingle();

      // Montar contexto
      const idade = residente ? Math.floor((Date.now() - new Date(residente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

      contextoResidente = `
DADOS DO RESIDENTE:
- Nome: ${residente?.nome_completo || 'Não informado'}
- Idade: ${idade ? `${idade} anos` : 'Não informada'}
- Quarto: ${residente?.quarto || 'Não informado'}
- Condições médicas: ${residente?.condicoes_medicas || 'Nenhuma registrada'}
- Observações gerais: ${residente?.observacoes_gerais || 'Nenhuma'}

CAMPOS DO FORMULÁRIO CONFIGURADOS:
${camposConfig?.map(c => `- [${c.secao}] ${c.label} (${c.tipo}${c.obrigatorio ? ', obrigatório' : ''})`).join('\n') || 'Nenhum campo configurado'}

STATUS DO PRONTUÁRIO DE HOJE:
${cicloHoje ? `Status: ${cicloHoje.status}, Início efetivo: ${cicloHoje.data_inicio_efetivo || 'Não iniciado'}` : 'Nenhum ciclo criado hoje'}

PRONTUÁRIOS DOS ÚLTIMOS 7 DIAS:
${prontuariosRecentes?.map(p => {
  let dados = {};
  try { dados = JSON.parse(p.descricao); } catch {}
  return `Data: ${p.data_registro} - ${JSON.stringify(dados).substring(0, 500)}`;
}).join('\n\n') || 'Nenhum prontuário recente encontrado'}

MEDICAMENTOS RECENTES:
${medicamentosRecentes?.map(m => 
  `${m.data_administracao} ${m.horario_administracao} - ${(m.medicamento as any)?.nome || 'N/A'} ${m.dosagem_administrada}${m.observacoes ? ` (${m.observacoes})` : ''}`
).join('\n') || 'Nenhum medicamento registrado recentemente'}`;
    }

    const systemPrompt = `Você é uma assistente de IA especializada em prontuários de residentes de uma Instituição de Longa Permanência para Idosos (ILPI) chamada Senex Care.

SEU PAPEL:
- Auxiliar os cuidadores no preenchimento correto e completo dos prontuários diários
- Monitorar padrões e alertar sobre mudanças importantes no estado dos residentes
- Sugerir textos e observações baseados no histórico do residente
- Identificar campos que ainda precisam ser preenchidos
- Destacar pontos de atenção baseados nos dados anteriores

DIRETRIZES:
1. Seja clara, objetiva e empática - você está auxiliando profissionais de saúde
2. Use linguagem técnica quando necessário, mas mantenha acessível
3. Quando sugerir textos para campos, use formato adequado ao tipo do campo
4. Sempre considere o histórico do residente ao fazer recomendações
5. Alerte sobre padrões preocupantes (mudanças de humor, alimentação, sono, dor)
6. Nunca invente dados - baseie-se apenas nas informações fornecidas
7. Responda em português brasileiro
8. Seja proativa: se perceber algo importante nos dados, mencione

AÇÕES DISPONÍVEIS:
- "sugerir_preenchimento": Sugira textos para campos específicos com base no histórico
- "analisar_status": Analise o estado atual do prontuário e identifique campos pendentes
- "monitorar_padroes": Identifique padrões e tendências nos últimos dias
- "orientar": Dê orientações gerais sobre cuidados baseados no perfil do residente
- "geral": Responda perguntas gerais sobre o prontuário

${contextoResidente}`;

    // Chamar Lovable AI com streaming
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes para IA.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('Erro na IA:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Erro ao consultar assistente de IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Erro no assistente de prontuário:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
