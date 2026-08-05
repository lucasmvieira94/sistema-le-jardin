
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';
import { supabase } from '@/integrations/supabase/client';
import {
  renderCabecalhoEmpresa,
  renderTitulo,
  renderCards,
  renderFolhaFuncionario,
  renderRodapeNumeracao,
  CORES,
} from './folhaPontoPdfLayout';

interface DadosEmpresa {
  nome_empresa: string;
  cnpj?: string;
  endereco?: string;
  logo_url?: string;
}

async function buscarDadosEmpresa(): Promise<DadosEmpresa | null> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_empresa')
      .select('nome_empresa, cnpj, endereco, logo_url')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('Erro ao buscar dados da empresa:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados da empresa:', error);
    return null;
  }
}

function formatTime(time: string | null): string {
  if (!time) return '--';
  return time.slice(0, 5);
}

function formatInterval(interval: string): string {
  if (!interval || interval === '00:00:00') return '00:00';
  return interval.slice(0, 5);
}

// Exportação individual PDF (layout inspirado na apropriação de horas)
export async function exportToPDF(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  if (dados.length === 0) return;

  const doc = new jsPDF('landscape');
  const funcionario = dados[0];
  const dadosEmpresa = await buscarDadosEmpresa();

  renderFolhaFuncionario(doc, dados, totais, mes, ano, dadosEmpresa);
  renderRodapeNumeracao(doc, dadosEmpresa);

  doc.save(`folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.pdf`);
}

// Exportação geral PDF com resumo consolidado na primeira página
export async function exportMultipleFuncionariosToPDF(
  funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }>,
  resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }>,
  mes: number,
  ano: number
) {
  if (funcionariosDados.length === 0) return;

  const doc = new jsPDF('landscape');
  const dadosEmpresa = await buscarDadosEmpresa();
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let y = renderCabecalhoEmpresa(doc, dadosEmpresa, 10);
  y = renderTitulo(doc, 'RELATÓRIO GERAL DE FOLHAS DE PONTO', mesNome.toUpperCase(), y);

  const totalFaltas = resumoGeral.reduce((a, f) => a + f.faltas, 0);
  y = renderCards(
    doc,
    [
      { label: 'Funcionários', valor: String(resumoGeral.length) },
      { label: 'Total de faltas', valor: String(totalFaltas) },
      { label: 'Período', valor: `${mes.toString().padStart(2, '0')}/${ano}` },
      { label: 'Folhas geradas', valor: String(funcionariosDados.filter(f => f.dados.length > 0).length) },
    ],
    y
  );

  autoTable(doc, {
    startY: y,
    head: [['Funcionário', 'CPF', 'H. Trabalhadas', 'H. Extras Diur.', 'H. Extras Not.', 'Faltas']],
    body: resumoGeral.map(f => [
      f.nome,
      f.cpf,
      formatInterval(f.horas_trabalhadas),
      formatInterval(f.horas_extras),
      formatInterval(f.horas_noturnas),
      f.faltas.toString()
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: CORES.borda, textColor: CORES.texto },
    headStyles: { fillColor: CORES.header, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: CORES.zebra },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 32 },
      5: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: 10, right: 10 }
  });

  for (const funcionarioData of funcionariosDados) {
    if (funcionarioData.dados.length === 0) continue;
    doc.addPage();
    renderFolhaFuncionario(doc, funcionarioData.dados, funcionarioData.totais, mes, ano, dadosEmpresa, {
      comCabecalhoEmpresa: true,
    });
  }

  renderRodapeNumeracao(doc, dadosEmpresa);
  doc.save(`folhas-ponto-geral-${mes.toString().padStart(2, '0')}-${ano}.pdf`);
}

// Exportação individual Excel
export async function exportToExcel(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dadosEmpresa = await buscarDadosEmpresa();

  const worksheetData: any[] = [];

  if (dadosEmpresa) {
    worksheetData.push([dadosEmpresa.nome_empresa]);
    if (dadosEmpresa.cnpj) worksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
    if (dadosEmpresa.endereco) worksheetData.push([dadosEmpresa.endereco]);
    worksheetData.push([]);
  }

  worksheetData.push(
    ['FOLHA DE PONTO MENSAL'],
    [],
    [`Funcionário: ${funcionario.funcionario_nome}`],
    [`CPF: ${funcionario.funcionario_cpf}`],
    [`Função: ${funcionario.funcionario_funcao}`],
    [`Escala: ${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`],
    [`Período: ${mesNome}`],
    [],
    ['Dia', 'Semana', 'Entrada', 'Int. Início', 'Int. Fim', 'Saída', 'H. Trabalhadas', 'H. Extras Diur.', 'H. Extras Not.', 'Falta', 'Abono'],
    ...dados.map(row => [
      row.dia.toString().padStart(2, '0'),
      new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
      formatTime(row.entrada),
      formatTime(row.intervalo_inicio),
      formatTime(row.intervalo_fim),
      formatTime(row.saida),
      formatInterval(row.horas_trabalhadas),
      formatInterval(row.horas_extras_diurnas),
      formatInterval(row.horas_extras_noturnas),
      row.faltas ? 'F' : '',
      row.abonos ? 'A' : ''
    ]),
    [],
    ['RESUMO MENSAL:'],
    [`Total de Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`],
    [`Total de Horas Extras Diurnas: ${formatInterval(totais.total_horas_extras_diurnas)}`],
    [`Total de Horas Extras Noturnas: ${formatInterval(totais.total_horas_extras_noturnas)}`],
    [`Total de Faltas: ${totais.total_faltas}`],
    [`Total de Abonos: ${totais.total_abonos}`],
    [`Dias Trabalhados: ${totais.dias_trabalhados}`]
  );

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Folha de Ponto');

  XLSX.writeFile(workbook, `folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.xlsx`);
}

// Exportação geral Excel
export async function exportMultipleFuncionariosToExcel(
  funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }>,
  resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }>,
  mes: number,
  ano: number
) {
  if (funcionariosDados.length === 0) return;

  const workbook = XLSX.utils.book_new();
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dadosEmpresa = await buscarDadosEmpresa();

  // Primeira aba: Resumo Geral
  const resumoWorksheetData: any[] = [];

  if (dadosEmpresa) {
    resumoWorksheetData.push([dadosEmpresa.nome_empresa]);
    if (dadosEmpresa.cnpj) resumoWorksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
    resumoWorksheetData.push([]);
  }

  resumoWorksheetData.push(
    ['RELATÓRIO GERAL DE FUNCIONÁRIOS'],
    [`Período: ${mesNome}`],
    [],
    ['Funcionário', 'CPF', 'H. Trabalhadas', 'H. Extras Diur.', 'H. Extras Not.', 'Faltas'],
    ...resumoGeral.map(f => [
      f.nome,
      f.cpf,
      formatInterval(f.horas_trabalhadas),
      formatInterval(f.horas_extras),
      formatInterval(f.horas_noturnas),
      f.faltas
    ])
  );

  const resumoWorksheet = XLSX.utils.aoa_to_sheet(resumoWorksheetData);
  XLSX.utils.book_append_sheet(workbook, resumoWorksheet, 'Resumo Geral');

  // Abas individuais
  funcionariosDados.forEach((funcionarioData) => {
    if (funcionarioData.dados.length > 0) {
      const funcionario = funcionarioData.dados[0];
      
      const worksheetData: any[] = [];

      if (dadosEmpresa) {
        worksheetData.push([dadosEmpresa.nome_empresa]);
        if (dadosEmpresa.cnpj) worksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
        if (dadosEmpresa.endereco) worksheetData.push([dadosEmpresa.endereco]);
        worksheetData.push([]);
      }

      worksheetData.push(
        ['FOLHA DE PONTO MENSAL'],
        [],
        [`Funcionário: ${funcionario.funcionario_nome}`],
        [`CPF: ${funcionario.funcionario_cpf}`],
        [`Função: ${funcionario.funcionario_funcao}`],
        [`Escala: ${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`],
        [`Período: ${mesNome}`],
        [],
        ['Dia', 'Semana', 'Entrada', 'Int. Início', 'Int. Fim', 'Saída', 'H. Trabalhadas', 'H. Extras Diur.', 'H. Extras Not.', 'Falta', 'Abono'],
        ...funcionarioData.dados.map(row => [
          row.dia.toString().padStart(2, '0'),
          new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
          formatTime(row.entrada),
          formatTime(row.intervalo_inicio),
          formatTime(row.intervalo_fim),
          formatTime(row.saida),
          formatInterval(row.horas_trabalhadas),
          formatInterval(row.horas_extras_diurnas),
          formatInterval(row.horas_extras_noturnas),
          row.faltas ? 'F' : '',
          row.abonos ? 'A' : ''
        ]),
        [],
        ['RESUMO MENSAL:'],
        [`Total de Horas Trabalhadas: ${formatInterval(funcionarioData.totais.total_horas_trabalhadas)}`],
        [`Total de Horas Extras Diurnas: ${formatInterval(funcionarioData.totais.total_horas_extras_diurnas)}`],
        [`Total de Horas Extras Noturnas: ${formatInterval(funcionarioData.totais.total_horas_extras_noturnas)}`],
        [`Total de Faltas: ${funcionarioData.totais.total_faltas}`],
        [`Total de Abonos: ${funcionarioData.totais.total_abonos}`],
        [`Dias Trabalhados: ${funcionarioData.totais.dias_trabalhados}`]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const sheetName = funcionario.funcionario_nome.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  });

  XLSX.writeFile(workbook, `folhas-ponto-geral-${mes.toString().padStart(2, '0')}-${ano}.xlsx`);
}
