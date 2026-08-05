import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';

/**
 * Layout compartilhado dos PDFs de folha de ponto (individual e geral).
 * Inspirado na tela de "Apropriação de Horas": cartões de KPI no topo,
 * tabela detalhada com intervalos/atrasos e coluna de situação.
 */

export interface DadosEmpresaPDF {
  nome_empresa: string;
  cnpj?: string;
  endereco?: string;
  logo_url?: string;
}

/* ---------- Paleta (mesma linguagem visual da UI) ---------- */
export const CORES = {
  titulo: [30, 41, 59] as [number, number, number],
  texto: [51, 65, 85] as [number, number, number],
  suave: [100, 116, 139] as [number, number, number],
  borda: [226, 232, 240] as [number, number, number],
  fundoCard: [248, 250, 252] as [number, number, number],
  header: [30, 64, 96] as [number, number, number],
  zebra: [247, 249, 252] as [number, number, number],
  alerta: [180, 83, 9] as [number, number, number],
  erro: [185, 28, 28] as [number, number, number],
};

const PAGE_W = 297; // A4 paisagem
const MARGIN = 10;

/* ---------- Helpers de tempo ---------- */
export const fmtHora = (t: string | null) => (!t ? '--:--' : t.slice(0, 5));

export const fmtIntervalo = (i?: string | null) =>
  !i || i === '00:00:00' ? '00:00' : i.slice(0, 5);

export const horaParaMin = (h?: string | null): number | null => {
  if (!h) return null;
  const [hh, mm] = h.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

/** Duração em minutos entre dois horários (trata virada de dia). */
export const duracaoMin = (ini?: string | null, fim?: string | null): number | null => {
  const i = horaParaMin(ini);
  const f = horaParaMin(fim);
  if (i === null || f === null) return null;
  return f >= i ? f - i : f + 1440 - i;
};

/** Atraso, em minutos, comparando a entrada real com a prevista na escala. */
export const minutosAtraso = (row: FolhaPontoData): number => {
  const prev = horaParaMin(row.funcionario_escala_entrada);
  const real = horaParaMin(row.entrada);
  if (prev === null || real === null) return 0;
  return Math.max(0, real - prev);
};

const intervaloParaMinutos = (i?: string | null): number => {
  if (!i) return 0;
  const [h, m] = i.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fmtMinutos = (min: number) =>
  `${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}h${String(Math.abs(min) % 60).padStart(2, '0')}`;

const detalharData = (data: string) => {
  const d = new Date(`${data}T12:00:00`);
  return {
    diaSemana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    completa: d.toLocaleDateString('pt-BR'),
    fimDeSemana: [0, 6].includes(d.getDay()),
  };
};

/* ---------- Blocos de desenho ---------- */

/** Cabeçalho institucional (nome, CNPJ, endereço e divisor). */
export function renderCabecalhoEmpresa(
  doc: jsPDF,
  empresa: DadosEmpresaPDF | null,
  y: number
): number {
  if (!empresa) return y;
  doc.setTextColor(...CORES.titulo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(empresa.nome_empresa, PAGE_W / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CORES.suave);
  const linha = [empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : null, empresa.endereco || null]
    .filter(Boolean)
    .join('  •  ');
  if (linha) {
    doc.setFontSize(8);
    doc.text(linha, PAGE_W / 2, y, { align: 'center' });
    y += 4;
  }
  doc.setDrawColor(...CORES.borda);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 6;
}

/** Faixa de título da seção. */
export function renderTitulo(doc: jsPDF, texto: string, subtitulo: string, y: number): number {
  doc.setFillColor(...CORES.header);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 10, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(texto, MARGIN + 4, y + 6.6);
  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitulo, PAGE_W - MARGIN - 4, y + 6.6, { align: 'right' });
  }
  doc.setTextColor(...CORES.texto);
  return y + 14;
}

/** Cartões de indicadores, equivalentes aos KPIs da apropriação de horas. */
export function renderCards(
  doc: jsPDF,
  cards: Array<{ label: string; valor: string }>,
  y: number
): number {
  const total = PAGE_W - MARGIN * 2;
  const gap = 3;
  const w = (total - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap);
    doc.setFillColor(...CORES.fundoCard);
    doc.setDrawColor(...CORES.borda);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, 15, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CORES.suave);
    doc.text(c.label.toUpperCase(), x + 3, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...CORES.titulo);
    doc.text(c.valor, x + 3, y + 12);
  });
  doc.setTextColor(...CORES.texto);
  return y + 20;
}

/** Bloco de identificação do funcionário. */
function renderIdentificacao(doc: jsPDF, f: FolhaPontoData, mesNome: string, y: number): number {
  autoTable(doc, {
    startY: y,
    body: [
      ['Funcionário', f.funcionario_nome, 'CPF', f.funcionario_cpf],
      ['Função', f.funcionario_funcao || '-', 'Período', mesNome],
      [
        'Escala',
        `${f.funcionario_escala_nome || '-'} (${fmtHora(f.funcionario_escala_entrada)} às ${fmtHora(
          f.funcionario_escala_saida
        )})`,
        '',
        '',
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1, textColor: CORES.texto },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24, textColor: CORES.suave },
      1: { cellWidth: 105 },
      2: { fontStyle: 'bold', cellWidth: 20, textColor: CORES.suave },
      3: { cellWidth: 80 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

/** Situação do dia (mesma lógica dos badges da tela). */
function situacaoDia(row: FolhaPontoData): string {
  if (row.faltas) return 'Falta';
  if (row.abonos) return 'Abono';
  if (!row.entrada && !row.saida) return 'Sem registro';
  if (row.entrada && !row.saida) return 'Saída pendente';
  if (minutosAtraso(row) > 15) return 'Atraso';
  return 'Completo';
}

/**
 * Renderiza a folha de ponto de um funcionário (uma seção/página).
 * Retorna a posição Y final.
 */
export function renderFolhaFuncionario(
  doc: jsPDF,
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number,
  empresa: DadosEmpresaPDF | null,
  opts: { comCabecalhoEmpresa?: boolean } = {}
): number {
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  let y = MARGIN;
  if (opts.comCabecalhoEmpresa !== false) y = renderCabecalhoEmpresa(doc, empresa, y);
  y = renderTitulo(doc, 'FOLHA DE PONTO MENSAL', mesNome.toUpperCase(), y);
  y = renderIdentificacao(doc, funcionario, mesNome, y);

  const totalIntervalos = dados.reduce(
    (acc, r) => acc + (duracaoMin(r.intervalo_inicio, r.intervalo_fim) ?? 0),
    0
  );
  const semSaida = dados.filter((r) => r.entrada && !r.saida).length;
  const atrasos = dados.filter((r) => minutosAtraso(r) > 15).length;

  y = renderCards(
    doc,
    [
      { label: 'Dias trabalhados', valor: String(totais.dias_trabalhados) },
      {
        label: 'Horas trabalhadas',
        valor: fmtMinutos(intervaloParaMinutos(totais.total_horas_trabalhadas)),
      },
      { label: 'Total de intervalos', valor: fmtMinutos(totalIntervalos) },
      {
        label: 'H. extras diurnas',
        valor: fmtMinutos(intervaloParaMinutos(totais.total_horas_extras_diurnas)),
      },
      {
        label: 'H. noturnas',
        valor: fmtMinutos(intervaloParaMinutos(totais.total_horas_extras_noturnas)),
      },
      { label: 'Faltas / Abonos', valor: `${totais.total_faltas} / ${totais.total_abonos}` },
      { label: 'Sem saída', valor: String(semSaida) },
      { label: 'Atrasos > 15min', valor: String(atrasos) },
    ],
    y
  );

  const body = dados.map((row) => {
    const info = detalharData(row.data);
    const atraso = minutosAtraso(row);
    const intervaloMin = duracaoMin(row.intervalo_inicio, row.intervalo_fim);
    return [
      `${info.diaSemana}\n${info.completa}`,
      atraso > 0 ? `${fmtHora(row.entrada)}\n+${atraso} min` : fmtHora(row.entrada),
      row.intervalo_inicio || row.intervalo_fim
        ? `${fmtHora(row.intervalo_inicio)} - ${fmtHora(row.intervalo_fim)}`
        : '--:--',
      intervaloMin !== null ? `${intervaloMin} min` : '-',
      fmtHora(row.saida),
      fmtIntervalo(row.horas_trabalhadas),
      fmtIntervalo(row.horas_extras_diurnas),
      fmtIntervalo(row.horas_extras_noturnas),
      situacaoDia(row),
      row.observacoes || '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Data',
        'Entrada',
        'Intervalo',
        'Total int.',
        'Saída',
        'H. Trab.',
        'H. Ext. D',
        'H. Not.',
        'Situação',
        'Observações',
      ],
    ],
    body,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.4,
      lineWidth: 0.1,
      lineColor: CORES.borda,
      textColor: CORES.texto,
      valign: 'middle',
    },
    headStyles: {
      fillColor: CORES.header,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: CORES.zebra },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 26 },
      9: { cellWidth: 'auto' },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = dados[data.row.index];
      if (!row) return;
      // Destaques equivalentes aos badges da interface
      if (data.column.index === 1 && minutosAtraso(row) > 0) {
        data.cell.styles.textColor = CORES.alerta;
      }
      if (data.column.index === 8) {
        const s = situacaoDia(row);
        if (s === 'Falta' || s === 'Saída pendente') {
          data.cell.styles.textColor = CORES.erro;
          data.cell.styles.fontStyle = 'bold';
        } else if (s === 'Atraso') {
          data.cell.styles.textColor = CORES.alerta;
          data.cell.styles.fontStyle = 'bold';
        } else if (s === 'Sem registro') {
          data.cell.styles.textColor = CORES.suave;
        }
      }
    },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY > 175) {
    doc.addPage();
    finalY = MARGIN + 10;
  }

  // Assinaturas
  doc.setDrawColor(...CORES.suave);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, finalY + 12, MARGIN + 100, finalY + 12);
  doc.line(PAGE_W - MARGIN - 100, finalY + 12, PAGE_W - MARGIN - 10, finalY + 12);
  doc.setFontSize(8);
  doc.setTextColor(...CORES.suave);
  doc.text('Assinatura do funcionário', MARGIN + 55, finalY + 16, { align: 'center' });
  doc.text('Assinatura do responsável', PAGE_W - MARGIN - 55, finalY + 16, { align: 'center' });
  doc.setTextColor(...CORES.texto);

  return finalY + 20;
}

/** Rodapé numerado em todas as páginas. */
export function renderRodapeNumeracao(doc: jsPDF, empresa: DadosEmpresaPDF | null) {
  const total = doc.getNumberOfPages();
  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...CORES.suave);
    doc.text(`${empresa?.nome_empresa ?? ''} • Emitido em ${emitido}`, MARGIN, h - 6);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, h - 6, { align: 'right' });
  }
  doc.setTextColor(...CORES.texto);
}
