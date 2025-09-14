
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';

function formatTime(time: string | null): string {
  if (!time) return '--';
  return time.slice(0, 5); // HH:MM
}

function formatInterval(interval: string): string {
  if (!interval || interval === '00:00:00') return '00:00';
  return interval.slice(0, 5); // HH:MM
}

export function exportToPDF(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  const doc = new jsPDF('portrait');
  
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Título
  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 105, 15, { align: 'center' });

  // Cabeçalho em formato de tabela
  const headerData = [
    ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
    ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
    ['Escala', `${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, '', '']
  ];

  autoTable(doc, {
    startY: 22,
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
    startY: 50,
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

export function exportToExcel(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number
) {
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Dados da planilha
  const worksheetData = [
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
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Folha de Ponto');

  // Download
  XLSX.writeFile(workbook, `folha-ponto-${funcionario.funcionario_nome.replace(/\s+/g, '-')}-${mes.toString().padStart(2, '0')}-${ano}.xlsx`);
}
