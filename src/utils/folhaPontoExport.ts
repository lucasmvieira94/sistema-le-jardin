
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
  return time.slice(0, 5);
}

function formatInterval(interval: string): string {
  if (!interval || interval === '00:00:00') return '00:00';
  return interval.slice(0, 5);
}

// Exportação individual PDF
export async function exportToPDF(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  const doc = new jsPDF('landscape');
  
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dadosEmpresa = await buscarDadosEmpresa();

  let currentY = 10;

  if (dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 148, currentY, { align: 'center' });
    currentY += 7;
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 148, currentY, { align: 'center' });
      currentY += 5;
    }
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 148, currentY, { align: 'center' });
      currentY += 8;
    }
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 287, currentY);
    currentY += 8;
  }

  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 148, currentY, { align: 'center' });
  currentY += 7;

  const headerData = [
    ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
    ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
    ['Escala', `${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, '', '']
  ];

  autoTable(doc, {
    startY: currentY,
    body: headerData,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 95 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 80 }
    }
  });

  const tableData = dados.map(row => [
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
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    head: [['Dia', 'Sem', 'Ent', 'I.Ini', 'I.Fim', 'Saí', 'H.Trab', 'H.Ext.D', 'H.Not', 'Falta', 'Abono']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineWidth: 0.1 },
    headStyles: { fillColor: [41, 128, 185], fontSize: 7, fontStyle: 'bold', cellPadding: 1 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 14 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text('RESUMO MENSAL:', 10, finalY);
  doc.setFontSize(8);
  doc.text(`Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`, 10, finalY + 8);
  doc.text(`Horas Extras Diurnas: ${formatInterval(totais.total_horas_extras_diurnas)}`, 10, finalY + 15);
  doc.text(`Horas Extras Noturnas: ${formatInterval(totais.total_horas_extras_noturnas)}`, 10, finalY + 22);
  doc.text(`Faltas: ${totais.total_faltas}`, 110, finalY + 8);
  doc.text(`Abonos: ${totais.total_abonos}`, 110, finalY + 15);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 110, finalY + 22);

  doc.save(`folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.pdf`);
}

// Adicionar página de funcionário ao PDF geral
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

  if (isFirstPage && dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 148, currentY, { align: 'center' });
    currentY += 7;
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 148, currentY, { align: 'center' });
      currentY += 5;
    }
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 148, currentY, { align: 'center' });
      currentY += 8;
    }
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 287, currentY);
    currentY += 8;
  }

  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 148, currentY, { align: 'center' });
  currentY += 7;

  const headerData = [
    ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
    ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
    ['Escala', `${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, '', '']
  ];

  autoTable(doc, {
    startY: currentY,
    body: headerData,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 95 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 80 }
    }
  });

  const tableData = dados.map(row => [
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
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 5,
    head: [['Dia', 'Sem', 'Ent', 'I.Ini', 'I.Fim', 'Saí', 'H.Trab', 'H.Ext.D', 'H.Not', 'Falta', 'Abono']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineWidth: 0.1 },
    headStyles: { fillColor: [41, 128, 185], fontSize: 7, fontStyle: 'bold', cellPadding: 1 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 14 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text('RESUMO MENSAL:', 10, finalY);
  doc.setFontSize(8);
  doc.text(`Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`, 10, finalY + 8);
  doc.text(`Horas Extras Diurnas: ${formatInterval(totais.total_horas_extras_diurnas)}`, 10, finalY + 15);
  doc.text(`Horas Extras Noturnas: ${formatInterval(totais.total_horas_extras_noturnas)}`, 10, finalY + 22);
  doc.text(`Faltas: ${totais.total_faltas}`, 150, finalY + 8);
  doc.text(`Abonos: ${totais.total_abonos}`, 150, finalY + 15);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 150, finalY + 22);
}

// Exportação geral PDF com resumo na primeira página
export async function exportMultipleFuncionariosToPDF(
  funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }>,
  resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }>,
  mes: number,
  ano: number
) {
  const doc = new jsPDF('landscape');
  
  if (funcionariosDados.length === 0) return;

  const dadosEmpresa = await buscarDadosEmpresa();
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  let currentY = 10;

  if (dadosEmpresa) {
    doc.setFontSize(16);
    doc.text(dadosEmpresa.nome_empresa, 148, currentY, { align: 'center' });
    currentY += 7;
    if (dadosEmpresa.cnpj) {
      doc.setFontSize(10);
      doc.text(`CNPJ: ${dadosEmpresa.cnpj}`, 148, currentY, { align: 'center' });
      currentY += 5;
    }
    if (dadosEmpresa.endereco) {
      doc.setFontSize(8);
      doc.text(dadosEmpresa.endereco, 148, currentY, { align: 'center' });
      currentY += 8;
    }
    doc.setLineWidth(0.5);
    doc.line(10, currentY, 287, currentY);
    currentY += 8;
  }
  
  doc.setFontSize(16);
  doc.text('RELATÓRIO GERAL DE FUNCIONÁRIOS', 148, currentY, { align: 'center' });
  currentY += 7;
  doc.setFontSize(12);
  doc.text(`Período: ${mesNome}`, 148, currentY, { align: 'center' });
  currentY += 10;

  const resumoHeaders = ['Funcionário', 'CPF', 'H. Trabalhadas', 'H. Extras Diur.', 'H. Extras Not.', 'Faltas'];
  const resumoData = resumoGeral.map(f => [
    f.nome,
    f.cpf,
    formatInterval(f.horas_trabalhadas),
    formatInterval(f.horas_extras),
    formatInterval(f.horas_noturnas),
    f.faltas.toString()
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [resumoHeaders],
    body: resumoData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
    headStyles: { fillColor: [41, 128, 185], fontSize: 9, fontStyle: 'bold', cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 30 },
      5: { halign: 'center', cellWidth: 20 }
    }
  });

  for (let index = 0; index < funcionariosDados.length; index++) {
    const funcionarioData = funcionariosDados[index];
    if (funcionarioData.dados.length > 0) {
      await addFuncionarioPageToPDF(doc, funcionarioData.dados, funcionarioData.totais, mes, ano, false, dadosEmpresa);
    }
  }

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
