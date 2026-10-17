import { jsPDF } from 'npm:jspdf@4.2.0';
import { autoTable } from 'npm:jspdf-autotable@5.0.2';

const saude = {
  doencas_previas: 'Doenças prévias / diagnósticos', alergias: 'Alergias (medicamentos, alimentos, outros)',
  cirurgias: 'Cirurgias realizadas', medicacoes_uso: 'Medicações em uso contínuo',
  plano_saude: 'Plano de saúde / convênio', medico_referencia: 'Médico(a) de referência',
  hospital_preferencia: 'Hospital de preferência em emergências', vacinas_recentes: 'Vacinas recentes (últimos 12 meses)',
};
const rotina = {
  alimentacao: 'Hábitos alimentares', restricoes_alimentares: 'Restrições alimentares', sono: 'Padrão de sono',
  higiene: 'Higiene pessoal', mobilidade: 'Mobilidade e dependência (AGDI)', uso_dispositivos: 'Uso de dispositivos auxiliares',
  lazer: 'Atividades de lazer e interesses', religiao: 'Religião / espiritualidade', comportamento: 'Comportamento e personalidade',
  rotina_familia: 'Rotina com a família', observacoes_cuidados: 'Observações importantes para os cuidadores',
};
const dataBR = (value: unknown) => typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';
const texto = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : 'Não informado';

export function gerarFichaPDF(ficha: Record<string, unknown>, nome: string, empresa: Record<string, unknown>): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text(doc.splitTextToSize(texto(empresa.nome_empresa), 180), 15, 18);
  let y = 18 + doc.splitTextToSize(texto(empresa.nome_empresa), 180).length * 6;
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const identificacao = [empresa.cnpj, empresa.endereco, empresa.cidade].filter(Boolean).join(' | ');
  const linhas = doc.splitTextToSize(identificacao, 180);
  doc.text(linhas, 15, y); y += linhas.length * 4 + 8;
  doc.setFont('helvetica', 'bold').setFontSize(13).text('FICHA DE ACOLHIMENTO', 15, y); y += 7;
  const secao = (titulo: string, body: string[][]) => {
    autoTable(doc, {
      startY: y, head: [[titulo, 'Informação']], body, theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [30, 64, 96] }, columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 115 } },
      margin: { left: 15, right: 15, top: 15, bottom: 18 }, rowPageBreak: 'avoid',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  };
  secao('Identificação', [
    ['Residente', nome], ['Status', ficha.status === 'aprovada' ? 'Aprovada' : 'Preenchida — aguardando validação'],
    ['Ficha criada em', dataBR(ficha.created_at)], ['Preenchida em', dataBR(ficha.data_preenchimento)],
    ['Aprovada em', dataBR(ficha.data_aprovacao)],
  ]);
  secao('Responsável pelo preenchimento', [
    ['Nome', texto(ficha.preenchido_por_nome)], ['CPF', texto(ficha.preenchido_por_cpf)],
    ['Parentesco', texto(ficha.preenchido_por_parentesco)], ['Telefone', texto(ficha.preenchido_por_telefone)],
    ['Aceite LGPD', ficha.aceite_lgpd ? `Confirmado em ${dataBR(ficha.data_aceite_lgpd)}` : 'Não confirmado'],
  ]);
  const respostas = (labels: Record<string, string>, value: unknown) => {
    const dados = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.entries(labels).map(([key, label]) => [label, texto(dados[key])]);
  };
  secao('Histórico de saúde e medicamentos', respostas(saude, ficha.historico_saude));
  secao('Hábitos, preferências e rotina', respostas(rotina, ficha.habitos_rotina));
  if (ficha.observacoes_admin) secao('Observações da equipe', [['Registro', texto(ficha.observacoes_admin)]]);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i).setFont('helvetica', 'normal').setFontSize(7);
    doc.text('Dados pessoais sensíveis — uso restrito ao residencial', 15, 289);
    doc.text(`Página ${i} de ${total}`, 195, 289, { align: 'right' });
  }
  doc.setProperties({ title: `Ficha de Acolhimento — ${nome}`, author: texto(empresa.nome_empresa), creator: 'SenexCare' });
  return doc.output('arraybuffer');
}