import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';
import { supabase } from '@/integrations/supabase/client';

interface DadosEmpresa {
  nome_empresa: string;
  cnpj?: string;
  endereco?: string;
}

async function buscarDadosEmpresa(): Promise<DadosEmpresa | null> {
  try {
    const { data } = await supabase
      .from('configuracoes_empresa')
      .select('nome_empresa, cnpj, endereco')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data as any;
  } catch {
    return null;
  }
}

const fmtTime = (t: string | null) => (!t ? '--' : t.slice(0, 5));
const fmtInterval = (i: string) => (!i || i === '00:00:00' ? '00:00' : i.slice(0, 5));

/**
 * Gera o PDF individual da folha de ponto de um funcionário e devolve os bytes.
 * Layout equivalente ao usado no relatório consolidado (paisagem, mesma tabela).
 */
export async function gerarFolhaPontoIndividualPDFBytes(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number,
  dadosEmpresaPre?: DadosEmpresa | null
): Promise<Uint8Array> {
  const doc = new jsPDF('landscape');
  const funcionario = dados[0];
  const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dadosEmpresa = dadosEmpresaPre ?? (await buscarDadosEmpresa());

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

  autoTable(doc, {
    startY: currentY,
    body: [
      ['Funcionário', funcionario.funcionario_nome, 'CPF', funcionario.funcionario_cpf],
      ['Função', funcionario.funcionario_funcao, 'Período', mesNome],
      ['Escala', `${funcionario.funcionario_escala_nome} (${fmtTime(funcionario.funcionario_escala_entrada)} às ${fmtTime(funcionario.funcionario_escala_saida)})`, '', ''],
    ],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 95 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 80 },
    },
  });

  const tableData = dados.map((row) => [
    row.dia.toString().padStart(2, '0'),
    new Date(row.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
    fmtTime(row.entrada),
    fmtTime(row.intervalo_inicio),
    fmtTime(row.intervalo_fim),
    fmtTime(row.saida),
    fmtInterval(row.horas_trabalhadas),
    fmtInterval(row.horas_extras_diurnas),
    fmtInterval(row.horas_extras_noturnas),
    row.faltas ? 'F' : '',
    row.abonos ? 'A' : '',
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
      10: { halign: 'center', cellWidth: 14 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text('RESUMO MENSAL:', 10, finalY);
  doc.setFontSize(8);
  doc.text(`Horas Trabalhadas: ${fmtInterval(totais.total_horas_trabalhadas)}`, 10, finalY + 8);
  doc.text(`Horas Extras Diurnas: ${fmtInterval(totais.total_horas_extras_diurnas)}`, 10, finalY + 15);
  doc.text(`Horas Extras Noturnas: ${fmtInterval(totais.total_horas_extras_noturnas)}`, 10, finalY + 22);
  doc.text(`Faltas: ${totais.total_faltas}`, 150, finalY + 8);
  doc.text(`Abonos: ${totais.total_abonos}`, 150, finalY + 15);
  doc.text(`Dias Trabalhados: ${totais.dias_trabalhados}`, 150, finalY + 22);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Publica a folha de ponto individual no bucket e cria/atualiza o registro
 * na tabela `folhas_ponto` para o funcionário acessar via portal.
 */
export async function publicarFolhaPontoFuncionario(params: {
  tenantId: string;
  funcionarioId: string;
  mes: number;
  ano: number;
  dados: FolhaPontoData[];
  totais: TotaisFolhaPonto;
  enviadoPor?: string | null;
  dadosEmpresa?: DadosEmpresa | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, funcionarioId, mes, ano, dados, totais, enviadoPor, dadosEmpresa } = params;
  if (!dados.length) return { ok: false, error: 'sem dados' };

  try {
    const bytes = await gerarFolhaPontoIndividualPDFBytes(dados, totais, mes, ano, dadosEmpresa);
    const path = `${tenantId}/${funcionarioId}/${ano}-${String(mes).padStart(2, '0')}.pdf`;

    const { error: upErr } = await supabase.storage
      .from('folhas-ponto')
      .upload(path, new Blob([bytes as any], { type: 'application/pdf' }), {
        upsert: true,
        contentType: 'application/pdf',
      });
    if (upErr) return { ok: false, error: upErr.message };

    const { error: dbErr } = await supabase.from('folhas_ponto').upsert(
      {
        tenant_id: tenantId,
        funcionario_id: funcionarioId,
        mes,
        ano,
        path,
        paginas: 1,
        tamanho_bytes: bytes.byteLength,
        enviado_por: enviadoPor ?? null,
      },
      { onConflict: 'tenant_id,funcionario_id,mes,ano' }
    );
    if (dbErr) return { ok: false, error: dbErr.message };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro desconhecido' };
  }
}