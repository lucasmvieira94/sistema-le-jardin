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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (token !== supabaseKey) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { messages, tenantId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date().toISOString().split('T')[0];
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const dataLimite7d = seteDiasAtras.toISOString().split('T')[0];

    // Buscar dados em paralelo para montar contexto completo
    const [
      { data: funcionarios },
      { data: escalas },
      { data: ciclosHoje },
      { data: ciclosAtrasados },
      { data: residentes },
      { data: estoqueFraldas },
      { data: medicamentosEstoque },
      { data: alertasNaoConf },
      { data: registrosPontoHoje },
      { data: prontuariosRecentes },
      { data: medicamentosAdminHoje },
      { data: usoFraldasRecente },
      { data: intercorrenciasAbertas },
    ] = await Promise.all([
      // Funcionários ativos com escala
      supabase.from('funcionarios')
        .select('id, nome_completo, funcao, escala_id, ativo, registra_ponto')
        .eq('ativo', true)
        .limit(100),

      // Escalas
      supabase.from('escalas')
        .select('id, nome, entrada, saida, intervalo_inicio, intervalo_fim, jornada_trabalho')
        .limit(50),

      // Ciclos de prontuário de hoje
      supabase.from('prontuario_ciclos')
        .select('id, residente_id, status, data_inicio_efetivo, data_encerramento')
        .eq('data_ciclo', hoje),

      // Ciclos atrasados (não encerrados de dias anteriores)
      supabase.from('prontuario_ciclos')
        .select('id, residente_id, data_ciclo, status')
        .in('status', ['em_andamento', 'nao_iniciado'])
        .lt('data_ciclo', hoje)
        .limit(50),

      // Residentes ativos
      supabase.from('residentes')
        .select('id, nome_completo, quarto, condicoes_medicas, numero_prontuario')
        .eq('ativo', true)
        .limit(100),

      // Estoque de fraldas com alerta
      supabase.from('estoque_fraldas')
        .select('id, tipo_fralda, tamanho, quantidade_atual, quantidade_minima, consumo_medio_diario, residente_id, marca')
        .eq('ativo', true)
        .limit(100),

      // Estoque de medicamentos com alerta
      supabase.from('estoque_medicamentos')
        .select('id, medicamento_id, quantidade_atual, quantidade_minima, data_validade, lote, medicamento:medicamentos(nome, controlado)')
        .eq('ativo', true)
        .limit(100),

      // Alertas de não conformidade pendentes
      supabase.from('alertas_nao_conformidade')
        .select('id, tipo_alerta, categoria, descricao, data_ocorrencia, status, detalhes, residente_id')
        .eq('status', 'pendente')
        .order('data_ocorrencia', { ascending: false })
        .limit(30),

      // Registros de ponto de hoje
      supabase.from('registros_ponto')
        .select('id, funcionario_id, entrada, saida, intervalo_inicio, intervalo_fim, data')
        .eq('data', hoje)
        .limit(200),

      // Prontuários recentes (7 dias)
      supabase.from('prontuario_registros')
        .select('id, residente_id, data_registro, tipo_registro, funcionario_id, horario_registro')
        .gte('data_registro', dataLimite7d)
        .eq('tipo_registro', 'prontuario_completo')
        .order('data_registro', { ascending: false })
        .limit(200),

      // Medicamentos administrados hoje
      supabase.from('administracao_medicamentos')
        .select('id, residente_id, medicamento_id, horario_administracao, status, medicamento:medicamentos(nome, controlado)')
        .eq('data_administracao', hoje)
        .limit(200),

      // Uso de fraldas recente (7 dias)
      supabase.from('uso_fraldas')
        .select('id, residente_id, data_uso, quantidade')
        .gte('data_uso', dataLimite7d)
        .limit(200),

      // Intercorrências em aberto
      supabase.from('intercorrencias')
        .select('id, titulo, descricao, categoria, prioridade, status, prazo_resolucao, created_at, funcionarios!intercorrencias_funcionario_id_fkey(nome_completo), residentes(nome_completo)')
        .in('status', ['aberta', 'em_analise', 'em_andamento'])
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    // Mapear nomes de residentes
    const residentesMap = new Map(residentes?.map(r => [r.id, r]) || []);
    const funcionariosMap = new Map(funcionarios?.map(f => [f.id, f]) || []);
    const escalasMap = new Map(escalas?.map(e => [e.id, e]) || []);

    // Montar resumo de escalas
    const funcionariosComEscala = funcionarios?.map(f => {
      const escala = f.escala_id ? escalasMap.get(f.escala_id) : null;
      const pontoHoje = registrosPontoHoje?.find(r => r.funcionario_id === f.id);
      return {
        nome: f.nome_completo,
        funcao: f.funcao,
        escala: escala ? `${escala.nome} (${escala.entrada}-${escala.saida})` : 'Sem escala',
        registrou_ponto: pontoHoje ? {
          entrada: pontoHoje.entrada,
          saida: pontoHoje.saida,
          intervalo: pontoHoje.intervalo_inicio ? `${pontoHoje.intervalo_inicio}-${pontoHoje.intervalo_fim}` : null,
        } : null,
      };
    }) || [];

    // Fraldas com estoque baixo
    const fraldasAlerta = estoqueFraldas?.filter(f => f.quantidade_atual <= f.quantidade_minima).map(f => ({
      tipo: f.tipo_fralda,
      tamanho: f.tamanho,
      marca: f.marca,
      atual: f.quantidade_atual,
      minimo: f.quantidade_minima,
      consumo_diario: f.consumo_medio_diario,
      dias_restantes: f.consumo_medio_diario && f.consumo_medio_diario > 0
        ? Math.floor(f.quantidade_atual / f.consumo_medio_diario) : null,
      residente: f.residente_id ? residentesMap.get(f.residente_id)?.nome_completo : 'Geral',
    })) || [];

    // Medicamentos com estoque baixo ou vencendo
    const hoje_date = new Date(hoje);
    const em30dias = new Date(hoje_date);
    em30dias.setDate(em30dias.getDate() + 30);

    const medicamentosAlerta = medicamentosEstoque?.filter(m => {
      const estoqueBaixo = m.quantidade_atual <= (m.quantidade_minima || 10);
      const vencendo = m.data_validade && new Date(m.data_validade) <= em30dias;
      return estoqueBaixo || vencendo;
    }).map(m => ({
      nome: (m.medicamento as any)?.nome || 'N/A',
      controlado: (m.medicamento as any)?.controlado || false,
      quantidade_atual: m.quantidade_atual,
      quantidade_minima: m.quantidade_minima,
      data_validade: m.data_validade,
      lote: m.lote,
    })) || [];

    // Prontuários de hoje - status
    const prontuariosStatus = {
      total_residentes: residentes?.length || 0,
      ciclos_criados: ciclosHoje?.length || 0,
      em_andamento: ciclosHoje?.filter(c => c.status === 'em_andamento').length || 0,
      encerrados: ciclosHoje?.filter(c => c.status === 'encerrado').length || 0,
      nao_iniciados: ciclosHoje?.filter(c => c.status === 'nao_iniciado').length || 0,
      atrasados: ciclosAtrasados?.length || 0,
      residentes_sem_ciclo: residentes?.filter(r =>
        !ciclosHoje?.some(c => c.residente_id === r.id)
      ).map(r => r.nome_completo) || [],
    };

    // Alertas pendentes formatados
    const alertasPendentes = alertasNaoConf?.map(a => ({
      tipo: a.tipo_alerta,
      categoria: a.categoria,
      descricao: a.descricao,
      data: a.data_ocorrencia,
      residente: a.residente_id ? residentesMap.get(a.residente_id)?.nome_completo : null,
      detalhes: a.detalhes,
    })) || [];

    const contexto = `
DATA DE HOJE: ${hoje}

═══ EQUIPE E ESCALAS ═══
Total de funcionários ativos: ${funcionarios?.length || 0}
Funcionários que registraram ponto hoje: ${registrosPontoHoje?.length || 0}

Detalhes:
${funcionariosComEscala.map(f =>
  `• ${f.nome} (${f.funcao}) - ${f.escala}${f.registrou_ponto
    ? ` ✅ Entrada: ${f.registrou_ponto.entrada}${f.registrou_ponto.saida ? `, Saída: ${f.registrou_ponto.saida}` : ''}`
    : ' ❌ Sem registro hoje'}`
).join('\n')}

═══ PRONTUÁRIOS ═══
${JSON.stringify(prontuariosStatus, null, 2)}

Prontuários ATRASADOS (dias anteriores não encerrados):
${ciclosAtrasados?.map(c => {
  const res = residentesMap.get(c.residente_id);
  return `• ${res?.nome_completo || 'N/A'} - Data: ${c.data_ciclo} - Status: ${c.status}`;
}).join('\n') || 'Nenhum atrasado'}

═══ FRALDAS COM ESTOQUE BAIXO ═══
${fraldasAlerta.length > 0
  ? fraldasAlerta.map(f =>
    `• ${f.tipo} ${f.tamanho}${f.marca ? ` (${f.marca})` : ''} - Residente: ${f.residente} - Estoque: ${f.atual}/${f.minimo}${f.dias_restantes !== null ? ` (~${f.dias_restantes} dias)` : ''}`
  ).join('\n')
  : 'Todos os estoques estão dentro do limite'}

═══ MEDICAMENTOS COM ALERTA ═══
${medicamentosAlerta.length > 0
  ? medicamentosAlerta.map(m =>
    `• ${m.nome}${m.controlado ? ' ⚠️ CONTROLADO' : ''} - Estoque: ${m.quantidade_atual}/${m.quantidade_minima}${m.data_validade ? ` - Validade: ${m.data_validade}` : ''}`
  ).join('\n')
  : 'Nenhum medicamento em alerta'}

═══ ALERTAS DE NÃO CONFORMIDADE PENDENTES ═══
${alertasPendentes.length > 0
  ? alertasPendentes.map(a =>
    `• [${a.tipo}] ${a.categoria}: ${a.descricao}${a.residente ? ` (${a.residente})` : ''} - ${a.data}`
  ).join('\n')
  : 'Nenhum alerta pendente'}

═══ RESUMO DE ATIVIDADE (7 DIAS) ═══
- Prontuários preenchidos: ${prontuariosRecentes?.length || 0}
- Medicamentos administrados hoje: ${medicamentosAdminHoje?.length || 0}
- Registros de uso de fraldas (7 dias): ${usoFraldasRecente?.length || 0}
`;

    const systemPrompt = `Você é a ASSISTENTE DE SUPERVISÃO da Senex Care, uma Instituição de Longa Permanência para Idosos (ILPI). Seu papel é auxiliar a supervisora nas suas funções diárias, fornecendo informações claras, alertas e recomendações.

SUAS CAPACIDADES:
1. **Escalas e Ponto**: Informar quem está trabalhando, quem faltou, horários de entrada/saída, funcionários sem registro de ponto
2. **Prontuários**: Status dos prontuários do dia (preenchidos, pendentes, atrasados), identificar residentes sem prontuário
3. **Fraldas**: Alertar sobre estoque baixo, consumo médio, previsão de duração
4. **Medicamentos**: Alertar sobre estoque baixo, vencimento próximo, medicamentos controlados
5. **Alertas e Não Conformidades**: Listar alertas pendentes, priorizar por gravidade
6. **Análise Geral**: Cruzar dados para identificar problemas e sugerir ações

DIRETRIZES:
- Seja direta, objetiva e use linguagem profissional
- Priorize informações urgentes (estoque crítico, prontuários atrasados, faltas)
- Use emojis para indicar urgência: 🔴 Crítico, 🟡 Atenção, 🟢 OK
- Sempre que possível, sugira ações concretas
- Responda em português brasileiro
- Formate as respostas de forma clara com tópicos e seções
- Se perguntarem algo que não está nos dados, diga que não tem essa informação disponível

${contexto}`;

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
    console.error('Erro no assistente supervisora:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
