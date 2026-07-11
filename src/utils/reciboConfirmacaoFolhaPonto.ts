import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

interface Params {
  funcionarioNome: string;
  funcionarioId: string;
  mes: number;
  ano: number;
  concorda: boolean;
  motivo?: string | null;
  confirmadoAt: string;
  folhaId: string;
}

async function empresa() {
  const { data } = await supabase
    .from('configuracoes_empresa')
    .select('nome_empresa, cnpj, endereco, cidade')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as any;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export async function gerarReciboConfirmacaoFolhaPonto(p: Params): Promise<Blob> {
  const emp = await empresa();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const larg = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text((emp?.nome_empresa ?? 'Instituição').toUpperCase(), larg / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  if (emp?.cnpj) { doc.text(`CNPJ: ${emp.cnpj}`, larg / 2, y, { align: 'center' }); y += 5; }
  if (emp?.endereco) { doc.text(emp.endereco, larg / 2, y, { align: 'center' }); y += 5; }
  y += 4;
  doc.setLineWidth(0.3);
  doc.line(15, y, larg - 15, y);
  y += 10;

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text(
    p.concorda ? 'RECIBO DE CONCORDÂNCIA — FOLHA DE PONTO'
               : 'REGISTRO DE DISCORDÂNCIA — FOLHA DE PONTO',
    larg / 2, y, { align: 'center' }
  );
  y += 12;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  const bloco = (label: string, valor: string) => {
    doc.setFont('times', 'bold'); doc.text(`${label}:`, 20, y);
    doc.setFont('times', 'normal'); doc.text(valor, 65, y);
    y += 7;
  };

  bloco('Funcionário', p.funcionarioNome);
  bloco('Período', `${MESES[p.mes - 1]} / ${p.ano}`);
  bloco('Confirmado em', fmt(p.confirmadoAt));
  bloco('Protocolo', p.folhaId);
  y += 4;

  doc.setFont('times', 'normal');
  const texto = p.concorda
    ? `Eu, ${p.funcionarioNome}, declaro para os devidos fins que revisei a folha de ponto referente ao período de ${MESES[p.mes - 1]} de ${p.ano} e CONCORDO integralmente com os registros de entrada, saída, intervalos, horas extras e demais lançamentos nela constantes, nada tendo a reclamar quanto à sua exatidão.`
    : `Eu, ${p.funcionarioNome}, declaro que revisei a folha de ponto referente ao período de ${MESES[p.mes - 1]} de ${p.ano} e NÃO CONCORDO com os registros apresentados, pelos motivos expostos abaixo, solicitando revisão pelo setor responsável.`;

  const linhas = doc.splitTextToSize(texto, larg - 40);
  doc.text(linhas, 20, y, { align: 'justify', maxWidth: larg - 40 });
  y += linhas.length * 5 + 6;

  if (!p.concorda) {
    doc.setFont('times', 'bold'); doc.text('Motivo:', 20, y); y += 6;
    doc.setFont('times', 'normal');
    const mLinhas = doc.splitTextToSize(p.motivo || '(não informado)', larg - 40);
    doc.text(mLinhas, 20, y);
    y += mLinhas.length * 5 + 6;
  }

  y = Math.max(y + 10, 220);
  doc.setFontSize(9);
  doc.setFont('times', 'italic');
  doc.text(
    'Documento gerado eletronicamente através do portal do cuidador. A confirmação foi realizada via acesso autenticado por PIN individual, ficando registrados data/hora, endereço IP e navegador utilizados.',
    20, y, { align: 'justify', maxWidth: larg - 40 }
  );

  y += 20;
  doc.setDrawColor(0);
  doc.line(60, y, larg - 60, y);
  doc.setFont('times', 'normal'); doc.setFontSize(10);
  doc.text(p.funcionarioNome, larg / 2, y + 6, { align: 'center' });

  return doc.output('blob');
}
