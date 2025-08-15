
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

  // Cabeçalho compacto
  doc.setFontSize(14);
  doc.text('FOLHA DE PONTO MENSAL', 105, 15, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(`Funcionário: ${funcionario.funcionario_nome}`, 10, 25);
  doc.text(`CPF: ${funcionario.funcionario_cpf}`, 10, 32);
  doc.text(`Função: ${funcionario.funcionario_funcao}`, 10, 39);
  doc.text(`Escala: ${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, 10, 46);
  doc.text(`Período: ${mesNome}`, 10, 53);

  // Tabela de registros otimizada para retrato
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
    startY: 60,
    head: [['Dia', 'Sem', 'Ent', 'I.Ini', 'I.Fim', 'Saí', 'H.Trab', 'H.Ext', 'Falta', 'Abono']],
    body: tableData,
    theme: 'grid',
    styles: { 
      fontSize: 7,
      cellPadding: 2
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      fontSize: 7,
      fontStyle: 'bold'
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
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(12);
  doc.text('RESUMO MENSAL:', 20, finalY);
  doc.text(`Total de Horas Trabalhadas: ${formatInterval(totais.total_horas_trabalhadas)}`, 20, finalY + 10);
  doc.text(`Total de Horas Extras Diurnas: ${formatInterval(totais.total_horas_extras_diurnas)}`, 20, finalY + 20);
  doc.text(`Total de Faltas: ${totais.total_faltas}`, 20, finalY + 30);
  doc.text(`Total de Abonos: ${totais.total_abonos}`, 20, finalY + 40);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 20, finalY + 50);

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
