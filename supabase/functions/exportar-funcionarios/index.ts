import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando exportação de funcionários');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request data
    const { filtro = 'todos' } = await req.json();
    console.log('📋 Filtro solicitado:', filtro);

    // Build query based on filter
    let query = supabase
      .from('funcionarios')
      .select(`
        nome_completo,
        email,
        cpf,
        funcao,
        data_nascimento,
        data_admissao,
        data_inicio_vigencia,
        ativo,
        codigo_4_digitos,
        escalas!inner(nome)
      `)
      .order('nome_completo', { ascending: true });

    // Apply filter
    if (filtro === 'ativos') {
      query = query.eq('ativo', true);
    } else if (filtro === 'inativos') {
      query = query.eq('ativo', false);
    }
    // For 'todos', no additional filter is needed

    const { data: funcionarios, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar funcionários:', error);
      throw error;
    }

    console.log(`📊 Encontrados ${funcionarios?.length || 0} funcionários`);

    if (!funcionarios || funcionarios.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum funcionário encontrado com os filtros aplicados' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate CSV content
    const csvHeaders = [
      'Nome Completo',
      'Email',
      'CPF',
      'Função',
      'Data Nascimento',
      'Data Admissão',
      'Data Início Vigência',
      'Status',
      'Código',
      'Escala'
    ];

    const csvRows = funcionarios.map(funcionario => [
      funcionario.nome_completo,
      funcionario.email,
      funcionario.cpf,
      funcionario.funcao,
      funcionario.data_nascimento,
      funcionario.data_admissao,
      funcionario.data_inicio_vigencia,
      funcionario.ativo ? 'Ativo' : 'Inativo',
      funcionario.codigo_4_digitos,
      funcionario.escalas?.nome || 'N/A'
    ]);

    // Convert to CSV format
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field}"` 
            : field
        ).join(',')
      )
    ].join('\n');

    // Add BOM for proper Excel encoding
    const csvWithBOM = '\uFEFF' + csvContent;

    // Generate filename with timestamp and filter
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `funcionarios_${filtro}_${timestamp}.csv`;

    console.log('✅ CSV gerado com sucesso');

    return new Response(csvWithBOM, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno no servidor' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});