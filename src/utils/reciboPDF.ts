import jsPDF from "jspdf";
import { formatarData } from "./dateUtils";
import { supabase } from "@/integrations/supabase/client";

export type ReciboPagamento = {
  residenteNome: string;
  competencia: string; // YYYY-MM-DD
  dataVencimento: string;
  dataPagamento: string;
  valorMensalidade: number;
  valorExtras: number;
  valorDesconto: number;
  valorTotal: number;
  valorPago: number;
  formaPagamento: string | null;
  numeroRecibo: string;
  observacoes?: string | null;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const valorPorExtenso = (valor: number): string => {
  // simples: emite o número formatado entre parênteses
  return `(${fmtBRL(valor)})`;
};

const competenciaLabel = (c: string) => {
  const [y, m] = c.split("-");
  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  return `${meses[Number(m) - 1]}/${y}`;
};

export async function gerarReciboPDF(r: ReciboPagamento) {
  // Carrega dados da empresa
  const { data: empresa } = await supabase
    .from("configuracoes_empresa")
    .select("nome_empresa, cnpj, endereco, cidade, logo_url")
    .limit(1)
    .maybeSingle();

  const nomeEmpresa = empresa?.nome_empresa ?? "Instituição";
  const cnpj = empresa?.cnpj ?? "";
  const endereco = empresa?.endereco ?? "";
  const cidade = empresa?.cidade ?? "";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("RECIBO DE PAGAMENTO", pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${r.numeroRecibo}`, pageW - margin, y, { align: "right" });
  doc.text(nomeEmpresa, margin, y);
  y += 5;
  if (cnpj) { doc.text(`CNPJ: ${cnpj}`, margin, y); y += 5; }
  if (endereco) { doc.text(endereco, margin, y); y += 5; }
  if (cidade) { doc.text(cidade, margin, y); y += 5; }

  y += 4;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Corpo
  doc.setFontSize(11);
  const corpo =
    `Recebemos de ${r.residenteNome} (ou seu responsável financeiro) a importância de ` +
    `${fmtBRL(r.valorPago)} ${valorPorExtenso(r.valorPago)}, referente à mensalidade ` +
    `da competência ${competenciaLabel(r.competencia)}, com vencimento em ` +
    `${formatarData(r.dataVencimento)}, paga em ${formatarData(r.dataPagamento)} ` +
    `via ${(r.formaPagamento ?? "—").toUpperCase()}.`;
  const linhas = doc.splitTextToSize(corpo, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 6 + 4;

  // Demonstrativo
  doc.setFont("times", "bold");
  doc.text("Demonstrativo:", margin, y);
  y += 6;
  doc.setFont("times", "normal");

  const linha = (label: string, valor: number, bold = false) => {
    if (bold) doc.setFont("times", "bold");
    doc.text(label, margin + 2, y);
    doc.text(fmtBRL(valor), pageW - margin - 2, y, { align: "right" });
    if (bold) doc.setFont("times", "normal");
    y += 6;
  };

  linha("Mensalidade", r.valorMensalidade);
  if (r.valorExtras > 0) linha("Extras / Serviços", r.valorExtras);
  if (r.valorDesconto > 0) linha("Descontos", -r.valorDesconto);
  doc.setDrawColor(200);
  doc.line(margin, y - 2, pageW - margin, y - 2);
  linha("Total da fatura", r.valorTotal, true);
  linha("Valor pago neste recibo", r.valorPago, true);
  const saldo = r.valorTotal - r.valorPago;
  if (saldo > 0.01) {
    doc.setTextColor(180, 0, 0);
    linha("Saldo em aberto", saldo, true);
    doc.setTextColor(0);
  }

  if (r.observacoes) {
    y += 4;
    doc.setFont("times", "italic");
    doc.text("Observações:", margin, y); y += 5;
    doc.setFont("times", "normal");
    const obs = doc.splitTextToSize(r.observacoes, pageW - margin * 2);
    doc.text(obs, margin, y);
    y += obs.length * 5;
  }

  // Local e data
  y += 14;
  const localData = `${cidade || "_______________"}, ${formatarData(r.dataPagamento)}.`;
  doc.text(localData, pageW - margin, y, { align: "right" });

  // Assinatura
  y += 22;
  doc.line(pageW / 2 - 45, y, pageW / 2 + 45, y);
  y += 5;
  doc.setFontSize(10);
  doc.text(nomeEmpresa, pageW / 2, y, { align: "center" });

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Recibo gerado eletronicamente em ${new Date().toLocaleString("pt-BR")}.`,
    pageW / 2,
    285,
    { align: "center" }
  );

  doc.save(`recibo-${r.numeroRecibo}.pdf`);
}