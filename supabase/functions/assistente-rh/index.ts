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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages } = await req.json();

    const hoje = new Date().toISOString().split('T')[0];
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const dataLimite7d = seteDiasAtras.toISOString().split('T')[0];

    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const dataLimite30d = trintaDiasAtras.toISOString().split('T')[0];

    // Fetch context data in parallel
    const [
      { data: funcionarios },
      { data: escalas },
      { data: registrosPonto7d },
      { data: afastamentos },
      { data: advertencias },
      { data: intercorrencias },
      { data: configEmpresa },
    ] = await Promise.all([
      supabase.from('funcionarios')
        .select('id, nome_completo, funcao, cpf, escala_id, ativo, registra_ponto, data_admissao, data_nascimento, data_inicio_vigencia, telefone, email')
        .eq('ativo', true)
        .order('nome_completo')
        .limit(200),

      supabase.from('escalas')
        .select('id, nome, entrada, saida, intervalo_inicio, intervalo_fim, jornada_trabalho')
        .limit(50),

      supabase.from('registros_ponto')
        .select('id, funcionario_id, data, entrada, intervalo_inicio, intervalo_fim, saida, observacoes')
        .gte('data', dataLimite7d)
        .lte('data', hoje)
        .order('data', { ascending: false })
        .limit(500),

      supabase.from('afastamentos')
        .select('id, funcionario_id, tipo_afastamento_id, data_inicio, data_fim, tipo_periodo, observacoes, quantidade_dias')
        .gte('data_inicio', dataLimite30d)
        .order('data_inicio', { ascending: false })
        .limit(100),

      supabase.from('advertencias_suspensoes')
        .select('id, funcionario_id, tipo, motivo, data_ocorrencia, descricao, dias_suspensao')
        .gte('data_ocorrencia', dataLimite30d)
        .order('data_ocorrencia', { ascending: false })
        .limit(50),

      supabase.from('intercorrencias')
        .select('id, titulo, descricao, categoria, prioridade, status, funcionario_id, created_at')
        .in('status', ['aberta', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(30),

      supabase.from('configuracoes_empresa')
        .select('*')
        .limit(1)
        .single(),
    ]);

    // Build context
    const funcMap = new Map((funcionarios || []).map(f => [f.id, f.nome_completo]));
    const escalaMap = new Map((escalas || []).map(e => [e.id, e]));

    // Calculate attendance summary
    const presencaPorFunc = new Map<string, { dias: number; faltas: number }>();
    (funcionarios || []).forEach(f => {
      if (!f.registra_ponto) return;
      const registrosFunc = (registrosPonto7d || []).filter(r => r.funcionario_id === f.id);
      const diasComRegistro = new Set(registrosFunc.filter(r => r.entrada).map(r => r.data)).size;
      presencaPorFunc.set(f.id, { dias: diasComRegistro, faltas: 7 - diasComRegistro });
    });

    const resumoPresenca = Array.from(presencaPorFunc.entries())
      .map(([id, { dias, faltas }]) => `- ${funcMap.get(id)}: ${dias} dias trabalhados, ${faltas} possíveis faltas`)
      .join('\n');

    const resumoAfastamentos = (afastamentos || [])
      .map(a => `- ${funcMap.get(a.funcionario_id) || 'Desconhecido'}: ${a.tipo_periodo} de ${a.data_inicio} a ${a.data_fim || 'indefinido'} (${a.quantidade_dias || '?'} dias) - ${a.observacoes || 'sem obs'}`)
      .join('\n') || 'Nenhum afastamento recente';

    const resumoAdvertencias = (advertencias || [])
      .map(a => `- ${funcMap.get(a.funcionario_id) || 'Desconhecido'}: ${a.tipo} em ${a.data_ocorrencia} - ${a.motivo}`)
      .join('\n') || 'Nenhuma advertência recente';

    const resumoIntercorrencias = (intercorrencias || [])
      .map(i => `- [${i.prioridade}/${i.status}] ${i.titulo}: ${i.descricao.slice(0, 100)}`)
      .join('\n') || 'Nenhuma intercorrência aberta';

    const resumoFuncionarios = (funcionarios || [])
      .map(f => {
        const esc = f.escala_id ? escalaMap.get(f.escala_id) : null;
        return `- ${f.nome_completo} | ${f.funcao} | Escala: ${esc ? `${esc.nome} (${esc.entrada}-${esc.saida})` : 'Sem escala'} | Admissão: ${f.data_admissao}`;
      })
      .join('\n');

    const configInfo = configEmpresa
      ? `Empresa: ${configEmpresa.nome_empresa} | Noturno: ${configEmpresa.hora_inicio_noturno}-${configEmpresa.hora_fim_noturno} | Intervalo mínimo: ${configEmpresa.intervalo_minimo_minutos}min | HE 50%: ${configEmpresa.adicional_hora_extra_50}% | HE 100%: ${configEmpresa.adicional_hora_extra_100}%`
      : 'Configurações não encontradas';

    const systemPrompt = `Você é um assistente especializado em Recursos Humanos e Departamento Pessoal brasileiro. Você auxilia gestores com rotinas de RH como controle de ponto, escalas, cálculos trabalhistas, advertências e gestão de pessoal.

DADOS ATUAIS DO SISTEMA (${hoje}):

=== CONFIGURAÇÕES DA EMPRESA ===
${configInfo}

=== FUNCIONÁRIOS ATIVOS (${(funcionarios || []).length}) ===
${resumoFuncionarios}

=== PRESENÇA DOS ÚLTIMOS 7 DIAS ===
${resumoPresenca}

=== AFASTAMENTOS (últimos 30 dias) ===
${resumoAfastamentos}

=== ADVERTÊNCIAS/SUSPENSÕES (últimos 30 dias) ===
${resumoAdvertencias}

=== INTERCORRÊNCIAS ABERTAS ===
${resumoIntercorrencias}

REGRAS TRABALHISTAS QUE VOCÊ CONHECE:
- CLT: jornada máxima 44h semanais, 8h diárias
- Hora extra: 50% dias úteis, 100% domingos/feriados
- Adicional noturno: 20% sobre hora normal (22h-05h)
- Hora noturna: 52min30s (redução ficta)
- Intervalo intrajornada: mínimo 1h para jornadas >6h
- DSR: direito ao descanso semanal remunerado
- Escalas: 12x36, 24x72, plantões com banco de horas
- Faltas justificadas: art. 473 CLT
- Advertências: verbal, escrita, suspensão (até 30 dias), justa causa

INSTRUÇÕES:
- Responda sempre em português brasileiro
- Seja objetivo e prático
- Quando possível, baseie-se nos dados reais do sistema
- Para cálculos trabalhistas, mostre o passo a passo
- Sugira ações corretivas quando identificar irregularidades
- Cite a legislação aplicável quando relevante
- Formate com markdown para melhor leitura`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos na configuração do workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Erro no gateway de IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (e) {
    console.error('assistente-rh error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
