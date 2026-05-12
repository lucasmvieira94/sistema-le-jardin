import jsPDF from "jspdf";
import { formatarData } from "./dateUtils";
import { supabase } from "@/integrations/supabase/client";

export type ReciboPagamento = {
  residenteNome: string;
  residenteId?: string;
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

const competenciaLabel = (c: string) => {
  const [y, m] = c.split("-");
  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  return `${meses[Number(m) - 1]}/${y}`;
};

async function carregarLogoDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(url, { mode: "cors" });
    const blob = await resp.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export async function gerarReciboPDF(r: ReciboPagamento) {
  const { data: empresa } = await supabase
    .from("configuracoes_empresa")
    .select("nome_empresa, cnpj, endereco, cidade, logo_url")
    .limit(1)
    .maybeSingle();

  const nomeEmpresa = empresa?.nome_empresa ?? "Instituição";
  const cnpj = empresa?.cnpj ?? "";
  const endereco = empresa?.endereco ?? "";
  const cidade = empresa?.cidade ?? "";
  const telefone = "";
  const emailEmp = "";
  const logo = empresa?.logo_url ? await carregarLogoDataUrl(empresa.logo_url) : null;

  // ===== Dados do responsável financeiro do residente =====
  let resp: {
    nome?: string | null;
    cpf?: string | null;
    endereco?: string | null;
    telefone?: string | null;
    email?: string | null;
  } | null = null;
  if (r.residenteId) {
    const { data: residente } = await supabase
      .from("residentes")
      .select("responsavel_nome, responsavel_cpf, responsavel_endereco, responsavel_telefone, responsavel_email")
      .eq("id", r.residenteId)
      .maybeSingle();
    if (residente) {
      resp = {
        nome: residente.responsavel_nome,
        cpf: residente.responsavel_cpf,
        endereco: residente.responsavel_endereco,
        telefone: residente.responsavel_telefone,
        email: residente.responsavel_email,
      };
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;

  // ===== Cabeçalho com logo =====
  if (logo) {
    const maxH = 20;
    const ratio = logo.w / logo.h;
    const h = maxH;
    const w = h * ratio;
    try {
      doc.addImage(logo.data, "PNG", (pageW - w) / 2, y, w, h);
    } catch {
      try { doc.addImage(logo.data, "JPEG", (pageW - w) / 2, y, w, h); } catch {}
    }
    y += maxH + 4;
  }

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(nomeEmpresa.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const linhaInst: string[] = [];
  if (cnpj) linhaInst.push(`CNPJ: ${cnpj}`);
  if (endereco) linhaInst.push(endereco);
  if (cidade) linhaInst.push(cidade);
  linhaInst.forEach((t) => { doc.text(t, pageW / 2, y, { align: "center" }); y += 4.5; });
  if (telefone || emailEmp) {
    doc.text([telefone, emailEmp].filter(Boolean).join("  •  "), pageW / 2, y, { align: "center" });
    y += 4.5;
  }

  y += 3;
  doc.setDrawColor(120);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ===== Título =====
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text("RECIBO DE PAGAMENTO", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${r.numeroRecibo}`, pageW / 2, y, { align: "center" });
  y += 8;

  // ===== Caixa de valor em destaque =====
  doc.setDrawColor(60);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, "FD");
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("VALOR RECEBIDO", margin + 4, y + 6);
  doc.setFontSize(14);
  doc.text(fmtBRL(r.valorPago), pageW - margin - 4, y + 9, { align: "right" });
  y += 20;

  // ===== Pagador / Responsável Financeiro =====
  if (resp?.nome) {
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("PAGADOR / RESPONSÁVEL FINANCEIRO", margin, y);
    y += 2;
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const linhasResp: string[] = [];
    linhasResp.push(`Nome: ${resp.nome}`);
    if (resp.cpf) linhasResp.push(`CPF: ${resp.cpf}`);
    if (resp.endereco) linhasResp.push(`Endereço: ${resp.endereco}`);
    const contato = [resp.telefone, resp.email].filter(Boolean).join("  •  ");
    if (contato) linhasResp.push(contato);
    linhasResp.push(`Residente: ${r.residenteNome}`);
    linhasResp.forEach((t) => {
      const wrap = doc.splitTextToSize(t, pageW - margin * 2 - 4);
      doc.text(wrap, margin + 2, y);
      y += wrap.length * 5;
    });
    y += 4;
    doc.setFontSize(11);
  }

  // Corpo
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const pagador = resp?.nome
    ? `${resp.nome}${resp.cpf ? `, CPF ${resp.cpf}` : ""}, responsável financeiro de ${r.residenteNome}`
    : `${r.residenteNome} (ou de seu responsável financeiro)`;
  const corpo =
    `Recebemos de ${pagador} a importância de ` +
    `${fmtBRL(r.valorPago)}, referente à mensalidade da competência ` +
    `${competenciaLabel(r.competencia)}, com vencimento em ${formatarData(r.dataVencimento)}, ` +
    `efetivamente paga em ${formatarData(r.dataPagamento)} por meio de ` +
    `${(r.formaPagamento ?? "—").toUpperCase()}, dando plena, geral e irrevogável quitação ` +
    `do valor ora recebido.`;
  const linhas = doc.splitTextToSize(corpo, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 5.5 + 6;

  // Demonstrativo
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("DEMONSTRATIVO", margin, y);
  y += 2;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
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
    doc.setFont("times", "bold");
    doc.text("OBSERVAÇÕES", margin, y); y += 2;
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont("times", "normal");
    const obs = doc.splitTextToSize(r.observacoes, pageW - margin * 2);
    doc.text(obs, margin, y);
    y += obs.length * 5.5;
  }

  // Local e data
  y += 16;
  const localData = `${cidade || "_______________"}, ${formatarData(r.dataPagamento)}.`;
  doc.text(localData, pageW / 2, y, { align: "center" });

  // Assinatura
  y += 24;
  doc.setDrawColor(80);
  doc.line(pageW / 2 - 45, y, pageW / 2 + 45, y);
  y += 5;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(nomeEmpresa, pageW / 2, y, { align: "center" });
  if (cnpj) {
    y += 4;
    doc.setFont("times", "normal");
    doc.text(`CNPJ: ${cnpj}`, pageW / 2, y, { align: "center" });
  }

  // Rodapé
  doc.setDrawColor(200);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Recibo gerado eletronicamente em ${new Date().toLocaleString("pt-BR")}.`,
    pageW / 2,
    pageH - 9,
    { align: "center" }
  );

  doc.save(`recibo-${r.numeroRecibo}.pdf`);
}