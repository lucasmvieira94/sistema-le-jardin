import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataHora } from "@/utils/dateUtils";
import {
  CAMPOS_HABITOS_ROTINA,
  CAMPOS_HISTORICO_SAUDE,
  type CampoFicha,
} from "@/components/residentes/FichaAcolhimentoCampos";

export interface FichaAcolhimentoPDFData {
  id: string;
  status: string;
  created_at: string;
  data_preenchimento: string | null;
  data_aprovacao: string | null;
  aceite_lgpd: boolean;
  data_aceite_lgpd: string | null;
  preenchido_por_nome: string | null;
  preenchido_por_cpf: string | null;
  preenchido_por_parentesco: string | null;
  preenchido_por_telefone: string | null;
  historico_saude: Record<string, string> | null;
  habitos_rotina: Record<string, string> | null;
  observacoes_admin: string | null;
}

type EmpresaPDF = {
  nome_empresa: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando preenchimento",
  preenchida: "Preenchida — aguardando validação",
  aprovada: "Aprovada",
};

export function podeBaixarFichaAcolhimento(status: string): boolean {
  return status === "preenchida" || status === "aprovada";
}

export function criarNomeArquivoFicha(residenteNome: string, createdAt: string): string {
  const nomeSeguro = residenteNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "residente";
  const data = new Date(createdAt);
  const dataSegura = Number.isNaN(data.getTime())
    ? "sem-data"
    : `${String(data.getDate()).padStart(2, "0")}-${String(data.getMonth() + 1).padStart(2, "0")}-${data.getFullYear()}`;
  return `ficha-acolhimento-${nomeSeguro}-${dataSegura}.pdf`;
}

function linhasCampos(
  campos: CampoFicha[],
  dados: Record<string, string> | null,
): string[][] {
  return campos.map((campo) => [campo.label, dados?.[campo.key]?.trim() || "Não informado"]);
}

function textoOuTraco(valor: string | null | undefined): string {
  return valor?.trim() || "—";
}

export async function baixarFichaAcolhimentoPDF(
  ficha: FichaAcolhimentoPDFData,
  residenteNome: string,
): Promise<void> {
  if (!podeBaixarFichaAcolhimento(ficha.status)) {
    throw new Error("A ficha precisa estar preenchida antes do download.");
  }

  const { data, error } = await supabase
    .from("configuracoes_empresa")
    .select("nome_empresa, cnpj, endereco, cidade")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar os dados da instituição: ${error.message}`);
  }

  const empresa = data as EmpresaPDF | null;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const colors = {
    title: [30, 41, 59] as [number, number, number],
    text: [51, 65, 85] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    header: [30, 64, 96] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
  };

  const rodape = () => {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...colors.border);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...colors.muted);
      doc.text("Documento emitido pelo Senex Care", margin, pageHeight - 8);
      doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
  };

  let y = 15;
  doc.setTextColor(...colors.title);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(empresa?.nome_empresa?.trim() || "Instituição", pageWidth / 2, y, { align: "center" });
  y += 5;

  const identificacaoEmpresa = [
    empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : null,
    empresa?.endereco,
    empresa?.cidade,
  ].filter(Boolean).join(" • ");
  if (identificacaoEmpresa) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    const linhas = doc.splitTextToSize(identificacaoEmpresa, contentWidth);
    doc.text(linhas, pageWidth / 2, y, { align: "center" });
    y += linhas.length * 3.5 + 2;
  }

  doc.setFillColor(...colors.header);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FICHA DE ACOLHIMENTO", pageWidth / 2, y + 7.5, { align: "center" });
  y += 17;

  autoTable(doc, {
    startY: y,
    body: [
      ["Residente", residenteNome, "Status", STATUS_LABEL[ficha.status] ?? ficha.status],
      ["Ficha criada em", formatarDataHora(ficha.created_at), "Preenchida em", ficha.data_preenchimento ? formatarDataHora(ficha.data_preenchimento) : "—"],
      ["Aprovada em", ficha.data_aprovacao ? formatarDataHora(ficha.data_aprovacao) : "—", "Aceite LGPD", ficha.aceite_lgpd ? "Confirmado" : "Não confirmado"],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, textColor: colors.text, lineColor: colors.border },
    columnStyles: {
      0: { fontStyle: "bold", textColor: colors.muted, cellWidth: 28 },
      1: { cellWidth: 62 },
      2: { fontStyle: "bold", textColor: colors.muted, cellWidth: 27 },
      3: { cellWidth: 63 },
    },
    margin: { left: margin, right: margin, bottom: 18 },
  });

  const identificacaoY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 6;
  autoTable(doc, {
    startY: identificacaoY,
    head: [["Responsável pelo preenchimento", "Informação"]],
    body: [
      ["Nome", textoOuTraco(ficha.preenchido_por_nome)],
      ["Parentesco", textoOuTraco(ficha.preenchido_por_parentesco)],
      ["CPF", textoOuTraco(ficha.preenchido_por_cpf)],
      ["Telefone", textoOuTraco(ficha.preenchido_por_telefone)],
      ["Consentimento LGPD", ficha.aceite_lgpd
        ? `Aceito${ficha.data_aceite_lgpd ? ` em ${formatarDataHora(ficha.data_aceite_lgpd)}` : ""}`
        : "Não confirmado"],
    ],
    theme: "grid",
    headStyles: { fillColor: colors.header, textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: colors.text, lineColor: colors.border },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 54 }, 1: { cellWidth: 126 } },
    margin: { left: margin, right: margin, bottom: 18 },
  });

  const adicionarSecao = (titulo: string, body: string[][]) => {
    const startY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 6;
    autoTable(doc, {
      startY,
      head: [[titulo, "Resposta"]],
      body,
      theme: "grid",
      headStyles: { fillColor: colors.header, textColor: [255, 255, 255], fontStyle: "bold" },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: colors.text,
        lineColor: colors.border,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 65 }, 1: { cellWidth: 115 } },
      rowPageBreak: "avoid",
      margin: { left: margin, right: margin, top: 15, bottom: 18 },
    });
  };

  adicionarSecao(
    "Histórico de saúde e medicamentos",
    linhasCampos(CAMPOS_HISTORICO_SAUDE, ficha.historico_saude),
  );
  adicionarSecao(
    "Hábitos, preferências e rotina",
    linhasCampos(CAMPOS_HABITOS_ROTINA, ficha.habitos_rotina),
  );

  if (ficha.observacoes_admin?.trim()) {
    adicionarSecao("Observações da equipe", [["Registro", ficha.observacoes_admin.trim()]]);
  }

  rodape();
  doc.setProperties({
    title: `Ficha de Acolhimento — ${residenteNome}`,
    subject: "Ficha de acolhimento do residente",
    author: empresa?.nome_empresa?.trim() || "Senex Care",
    creator: "Senex Care",
  });
  doc.save(criarNomeArquivoFicha(residenteNome, ficha.created_at));
}