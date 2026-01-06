
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';
import { supabase } from '@/integrations/supabase/client';

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
  return time.slice(0, 5); // HH:MM
}

function formatInterval(interval: string): string {
  if (!interval || interval === '00:00:00') return '00:00';
  return interval.slice(0, 5); // HH:MM
}

// Função para exportação individual (mantida como estava)
export async function exportToPDF(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  const doc = new jsPDF('portrait');
  
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dadosEmpresa = await buscarDadosEmpresa();

  let currentY = 10;

  // Cabeçalho da empresa
  if (dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 105, currentY, { align: 'center' });
    currentY += 7;
    
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 105, currentY, { align: 'center' });
      currentY += 5;
    }
    
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 105, currentY, { align: 'center' });
      currentY += 8;
    }
    
    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 200, currentY);
    currentY += 8;
  }

  // Título
  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 105, currentY, { align: 'center' });
  currentY += 7;

  // Cabeçalho em formato de tabela
  const headerData = [
    ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
    ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
    ['Escala', `${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, '', '']
  ];

  autoTable(doc, {
    startY: currentY,
    body: headerData,
    theme: 'plain',
    styles: { 
      fontSize: 8,
      cellPadding: 1
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 65 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 80 }
    }
  });

  // Tabela de registros otimizada
  const tableData = dados.map(row => [
    row.dia.toString().padStart(2, '0'),
    new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
    formatTime(row.entrada),
    formatTime(row.intervalo_inicio),
    formatTime(row.intervalo_fim),
    formatTime(row.saida),
    formatInterval(row.horas_trabalhadas),
    formatInterval(row.horas_extras_diurnas),
    row.faltas ? 'F' : '',
    row.abonos ? 'A' : ''
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    head: [['Dia', 'Sem', 'Ent', 'I.Ini', 'I.Fim', 'Saí', 'H.Trab', 'H.Ext', 'Falta', 'Abono']],
    body: tableData,
    theme: 'grid',
    styles: { 
      fontSize: 7,
      cellPadding: 1,
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: 1
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 }, // Dia
      1: { halign: 'center', cellWidth: 20 }, // Sem
      2: { halign: 'center', cellWidth: 18 }, // Entrada
      3: { halign: 'center', cellWidth: 18 }, // Int Ini
      4: { halign: 'center', cellWidth: 18 }, // Int Fim
      5: { halign: 'center', cellWidth: 18 }, // Saída
      6: { halign: 'center', cellWidth: 20 }, // H Trab
      7: { halign: 'center', cellWidth: 18 }, // H Extra
      8: { halign: 'center', cellWidth: 15 }, // Falta
      9: { halign: 'center', cellWidth: 15 }  // Abono
    }
  });

  // Totais
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text('RESUMO MENSAL:', 10, finalY);
  doc.setFontSize(8);
  doc.text(`Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`, 10, finalY + 8);
  doc.text(`Horas Extras: ${formatInterval(totais.total_horas_extras_diurnas)}`, 10, finalY + 15);
  doc.text(`Faltas: ${totais.total_faltas}`, 10, finalY + 22);
  doc.text(`Abonos: ${totais.total_abonos}`, 10, finalY + 29);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 10, finalY + 36);

  // Download
  doc.save(`folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.pdf`);
}

// Nova função para exportação individual de funcionário em PDF geral
async function addFuncionarioPageToPDF(
  doc: jsPDF,
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number,
  isFirstPage = false,
  dadosEmpresa: DadosEmpresa | null = null
) {
  if (!isFirstPage) {
    doc.addPage();
  }
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let currentY = 10;

  // Cabeçalho da empresa (apenas na primeira página)
  if (isFirstPage && dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 105, currentY, { align: 'center' });
    currentY += 7;
    
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 105, currentY, { align: 'center' });
      currentY += 5;
    }
    
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 105, currentY, { align: 'center' });
      currentY += 8;
    }
    
    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 200, currentY);
    currentY += 8;
  }

  // Título
  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 105, currentY, { align: 'center' });
  currentY += 7;

  // Cabeçalho em formato de tabela
  const headerData = [
    ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
    ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
    ['Escala', `${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, '', '']
  ];

  autoTable(doc, {
    startY: currentY,
    body: headerData,
    theme: 'plain',
    styles: { 
      fontSize: 8,
      cellPadding: 1
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 65 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 80 }
    }
  });

  // Tabela de registros
  const tableData = dados.map(row => [
    row.dia.toString().padStart(2, '0'),
    new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
    formatTime(row.entrada),
    formatTime(row.intervalo_inicio),
    formatTime(row.intervalo_fim),
    formatTime(row.saida),
    formatInterval(row.horas_trabalhadas),
    formatInterval(row.horas_extras_diurnas),
    row.faltas ? 'F' : '',
    row.abonos ? 'A' : ''
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    head: [['Dia', 'Sem', 'Ent', 'I.Ini', 'I.Fim', 'Saí', 'H.Trab', 'H.Ext', 'Falta', 'Abono']],
    body: tableData,
    theme: 'grid',
    styles: { 
      fontSize: 7,
      cellPadding: 1,
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: 1
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 15 },
      9: { halign: 'center', cellWidth: 15 }
    }
  });

  // Totais individuais
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text('RESUMO MENSAL:', 10, finalY);
  doc.setFontSize(8);
  doc.text(`Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`, 10, finalY + 8);
  doc.text(`Horas Extras: ${formatInterval(totais.total_horas_extras_diurnas)}`, 10, finalY + 15);
  doc.text(`Faltas: ${totais.total_faltas}`, 10, finalY + 22);
  doc.text(`Abonos: ${totais.total_abonos}`, 10, finalY + 29);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 10, finalY + 36);
}

// Nova função para exportação geral com múltiplos funcionários
// PRIMEIRA PÁGINA: Resumo geral de todos os funcionários
export async function exportMultipleFuncionariosToPDF(
  funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }>,
  resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }>,
  mes: number,
  ano: number
) {
  const doc = new jsPDF('portrait');
  
  if (funcionariosDados.length === 0) return;

  const dadosEmpresa = await buscarDadosEmpresa();
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  // ========== PRIMEIRA PÁGINA: RESUMO GERAL ==========
  let currentY = 10;

  // Cabeçalho da empresa na página de resumo
  if (dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 105, currentY, { align: 'center' });
    currentY += 7;
    
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 105, currentY, { align: 'center' });
      currentY += 5;
    }
    
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 105, currentY, { align: 'center' });
      currentY += 8;
    }
    
    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 200, currentY);
    currentY += 8;
  }
  
  // Título da página de resumo
  doc.setFontSize(16);
  doc.text('RELATÓRIO GERAL DE FUNCIONÁRIOS', 105, currentY, { align: 'center' });
  currentY += 7;
  doc.setFontSize(12);
  doc.text(`Período: ${mesNome}`, 105, currentY, { align: 'center' });
  currentY += 10;

  // Tabela de resumo
  const resumoHeaders = ['Funcionário', 'CPF', 'H. Trabalhadas', 'H. Extras', 'H. Noturnas', 'Faltas'];
  const resumoData = resumoGeral.map(funcionario => [
    funcionario.nome,
    funcionario.cpf,
    formatInterval(funcionario.horas_trabalhadas),
    formatInterval(funcionario.horas_extras),
    formatInterval(funcionario.horas_noturnas),
    funcionario.faltas.toString()
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [resumoHeaders],
    body: resumoData,
    theme: 'grid',
    styles: { 
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 50 }, // Nome
      1: { cellWidth: 35 }, // CPF
      2: { halign: 'center', cellWidth: 25 }, // H. Trabalhadas
      3: { halign: 'center', cellWidth: 20 }, // H. Extras
      4: { halign: 'center', cellWidth: 20 }, // H. Noturnas
      5: { halign: 'center', cellWidth: 15 }  // Faltas
    }
  });

  // ========== PÁGINAS SEGUINTES: FOLHAS INDIVIDUAIS ==========
  for (let index = 0; index < funcionariosDados.length; index++) {
    const funcionarioData = funcionariosDados[index];
    if (funcionarioData.dados.length > 0) {
      // Sempre adiciona nova página (resumo está na primeira)
      await addFuncionarioPageToPDF(doc, funcionarioData.dados, funcionarioData.totais, mes, ano, false, dadosEmpresa);
    }
  }

  // Download
  doc.save(`folhas-ponto-geral-${mes.toString().padStart(2, '0')}-${ano}.pdf`);
}

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

  // Dados da planilha
  const worksheetData: any[] = [];

  // Cabeçalho da empresa
  if (dadosEmpresa) {
    worksheetData.push([dadosEmpresa.nome_empresa]);
    if (dadosEmpresa.cnpj) {
      worksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
    }
    if (dadosEmpresa.endereco) {
      worksheetData.push([dadosEmpresa.endereco]);
    }
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
    ['Dia', 'Semana', 'Entrada', 'Int. Início', 'Int. Fim', 'Saída', 'H. Trabalhadas', 'H. Extras', 'Falta', 'Abono'],
    ...dados.map(row => [
      row.dia.toString().padStart(2, '0'),
      new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
      formatTime(row.entrada),
      formatTime(row.intervalo_inicio),
      formatTime(row.intervalo_fim),
      formatTime(row.saida),
      formatInterval(row.horas_trabalhadas),
      formatInterval(row.horas_extras_diurnas),
      row.faltas ? 'F' : '',
      row.abonos ? 'A' : ''
    ]),
    [],
    ['RESUMO MENSAL:'],
    [`Total de Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`],
    [`Total de Horas Extras Diurnas: ${formatInterval(totais.total_horas_extras_diurnas)}`],
    [`Total de Faltas: ${totais.total_faltas}`],
    [`Total de Abonos: ${totais.total_abonos}`],
    [`Dias Trabalhados: ${totais.dias_trabalhados}`]
  );

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Folha de Ponto');

  // Download
  XLSX.writeFile(workbook, `folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.xlsx`);
}

// Nova função para exportação geral com múltiplos funcionários para Excel
// PRIMEIRA ABA: Resumo geral de todos os funcionários
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

  // ========== PRIMEIRA ABA: RESUMO GERAL ==========
  const resumoWorksheetData: any[] = [];

  // Cabeçalho da empresa no resumo
  if (dadosEmpresa) {
    resumoWorksheetData.push([dadosEmpresa.nome_empresa]);
    if (dadosEmpresa.cnpj) {
      resumoWorksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
    }
    resumoWorksheetData.push([]);
  }

  resumoWorksheetData.push(
    ['RELATÓRIO GERAL DE FUNCIONÁRIOS'],
    [`Período: ${mesNome}`],
    [],
    ['Funcionário', 'CPF', 'H. Trabalhadas', 'H. Extras', 'H. Noturnas', 'Faltas'],
    ...resumoGeral.map(funcionario => [
      funcionario.nome,
      funcionario.cpf,
      formatInterval(funcionario.horas_trabalhadas),
      formatInterval(funcionario.horas_extras),
      formatInterval(funcionario.horas_noturnas),
      funcionario.faltas
    ])
  );

  const resumoWorksheet = XLSX.utils.aoa_to_sheet(resumoWorksheetData);
  XLSX.utils.book_append_sheet(workbook, resumoWorksheet, 'Resumo Geral');

  // ========== ABAS SEGUINTES: FOLHAS INDIVIDUAIS ==========
  funcionariosDados.forEach((funcionarioData, index) => {
    if (funcionarioData.dados.length > 0) {
      const funcionario = funcionarioData.dados[0];
      
      const worksheetData: any[] = [];

      // Cabeçalho da empresa
      if (dadosEmpresa) {
        worksheetData.push([dadosEmpresa.nome_empresa]);
        if (dadosEmpresa.cnpj) {
          worksheetData.push([`CNPJ: ${dadosEmpresa.cnpj}`]);
        }
        if (dadosEmpresa.endereco) {
          worksheetData.push([dadosEmpresa.endereco]);
        }
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
        ['Dia', 'Semana', 'Entrada', 'Int. Início', 'Int. Fim', 'Saída', 'H. Trabalhadas', 'H. Extras', 'Falta', 'Abono'],
        ...funcionarioData.dados.map(row => [
          row.dia.toString().padStart(2, '0'),
          new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
          formatTime(row.entrada),
          formatTime(row.intervalo_inicio),
          formatTime(row.intervalo_fim),
          formatTime(row.saida),
          formatInterval(row.horas_trabalhadas),
          formatInterval(row.horas_extras_diurnas),
          row.faltas ? 'F' : '',
          row.abonos ? 'A' : ''
        ]),
        [],
        ['RESUMO MENSAL:'],
        [`Total de Horas Trabalhadas: ${formatInterval(funcionarioData.totais.total_horas_trabalhadas)}`],
        [`Total de Horas Extras Diurnas: ${formatInterval(funcionarioData.totais.total_horas_extras_diurnas)}`],
        [`Total de Faltas: ${funcionarioData.totais.total_faltas}`],
        [`Total de Abonos: ${funcionarioData.totais.total_abonos}`],
        [`Dias Trabalhados: ${funcionarioData.totais.dias_trabalhados}`]
      );

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const sheetName = funcionario.funcionario_nome.substring(0, 31); // Limite de 31 caracteres para nome da aba
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  });

  // Download
  XLSX.writeFile(workbook, `folhas-ponto-geral-${mes.toString().padStart(2, '0')}-${ano}.xlsx`);
}
