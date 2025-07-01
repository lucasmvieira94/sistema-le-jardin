
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
  const doc = new jsPDF('landscape');
  
  if (dados.length === 0) return;
  
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Cabeçalho
  doc.setFontSize(16);
  doc.text('FOLHA DE PONTO MENSAL', 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Funcionário: ${funcionario.funcionario_nome}`, 20, 35);
  doc.text(`CPF: ${funcionario.funcionario_cpf}`, 20, 45);
  doc.text(`Função: ${funcionario.funcionario_funcao}`, 20, 55);
  doc.text(`Escala: ${funcionario.funcionario_escala_nome} (${formatTime(funcionario.funcionario_escala_entrada)} às ${formatTime(funcionario.funcionario_escala_saida)})`, 20, 65);
  doc.text(`Período: ${mesNome}`, 20, 75);

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
    row.abonos ? 'A' : '',
    row.observacoes || ''
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Dia', 'Sem', 'Entrada', 'Int. Ini', 'Int. Fim', 'Saída', 'H. Trab.', 'H. Extra', 'Falta', 'Abono', 'Obs']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] }
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
    ['Dia', 'Semana', 'Entrada', 'Int. Início', 'Int. Fim', 'Saída', 'H. Trabalhadas', 'H. Extras', 'Falta', 'Abono', 'Observações'],
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
      row.abonos ? 'A' : '',
      row.observacoes || ''
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
