import jsPDF from "jspdf";
import { formatarData } from "./dateUtils";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

export type ReciboDespesa = {
  contaId: string;
  tenantId?: string | null;
  descricao: string;
  categoria?: string | null;
  beneficiarioNome: string;
  beneficiarioDocumento?: string | null;
  valor: number;
  dataPagamento: string; // YYYY-MM-DD
  dataVencimento?: string | null;
  formaPagamento: string | null;
  numeroRecibo: string;
  observacoes?: string | null;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Converte número em extenso (pt-BR) para reforçar a quitação.
function valorPorExtenso(valor: number): string {
  const u = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const d = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const c = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  const trecho = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    if (n < 20) return u[n];
    if (n < 100) {
      const r = n % 10;
      return d[Math.floor(n / 10)] + (r ? " e " + u[r] : "");
    }
    const r = n % 100;
    return c[Math.floor(n / 100)] + (r ? " e " + trecho(r) : "");
  };
  const escrever = (n: number): string => {
    if (n === 0) return "zero";
    const milhoes = Math.floor(n / 1_000_000);
    const milhares = Math.floor((n % 1_000_000) / 1000);
    const resto = n % 1000;
    const partes: string[] = [];
    if (milhoes) partes.push((milhoes === 1 ? "um milhão" : trecho(milhoes) + " milhões"));
    if (milhares) partes.push((milhares === 1 ? "mil" : trecho(milhares) + " mil"));
    if (resto) partes.push(trecho(resto));
    return partes.join(" e ");
  };
  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  let txt = `${escrever(reais)} ${reais === 1 ? "real" : "reais"}`;
  if (centavos > 0) {
    txt += ` e ${escrever(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  }
  return txt;
}

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

export async function gerarReciboDespesaPDF(r: ReciboDespesa) {
  const { data: empresa } = await supabase
    .from("configuracoes_empresa")
    .select("nome_empresa, cnpj, endereco, cidade, logo_url")
    .limit(1)
    .maybeSingle();

  const nomeEmpresa = empresa?.nome_empresa ?? "Instituição";
  const cnpj = empresa?.cnpj ?? "";
  const endereco = empresa?.endereco ?? "";
  const cidade = empresa?.cidade ?? "";
  const logo = empresa?.logo_url ? await carregarLogoDataUrl(empresa.logo_url) : null;

  // ===== Registra o documento e gera código de autenticidade (hash + QR) =====
  const dadosEstruturais = {
    numero_recibo: r.numeroRecibo,
    conta_id: r.contaId,
    descricao: r.descricao,
    categoria: r.categoria ?? null,
    beneficiario_nome: r.beneficiarioNome,
    beneficiario_documento: r.beneficiarioDocumento ?? null,
    valor: r.valor,
    data_pagamento: r.dataPagamento,
    data_vencimento: r.dataVencimento ?? null,
    forma_pagamento: r.formaPagamento ?? null,
    observacoes: r.observacoes ?? null,
    pagador_empresa: nomeEmpresa,
    pagador_cnpj: cnpj,
  };

  let autenticidade: { id: string; hash: string; urlVerificacao: string; qrDataUrl: string } | null = null;
  try {
    const { data: regData, error: regErr } = await supabase.functions.invoke(
      "registrar-documento",
      {
        body: {
          tipo: "recibo_despesa",
          referencia_id: r.contaId,
          referencia_tabela: "contas_pagar",
          numero_documento: r.numeroRecibo,
          titular_nome: r.beneficiarioNome,
          dados_estruturais: dadosEstruturais,
          tenant_id: r.tenantId ?? null,
        },
      }
    );
    if (!regErr && regData?.id && regData?.hash) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const urlVerificacao = `${origin}/verificar-documento?id=${encodeURIComponent(
        regData.id
      )}&hash=${encodeURIComponent(regData.hash)}`;
      const qrDataUrl = await QRCode.toDataURL(urlVerificacao, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      autenticidade = { id: regData.id, hash: regData.hash, urlVerificacao, qrDataUrl };
    }
  } catch {
    // Recibo continua sendo emitido sem o rodapé de autenticidade.
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  try {
    doc.setDocumentProperties({
      title: `Recibo de Pagamento ${r.numeroRecibo}`,
      subject: "Recibo de pagamento de despesa",
      author: nomeEmpresa,
      creator: nomeEmpresa,
      keywords: `recibo,despesa,pagamento,${r.numeroRecibo}`,
    });
  } catch {}

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;

  // Cabeçalho com logo (centralizado)
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

  y += 3;
  doc.setDrawColor(120);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Título
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text("RECIBO DE PAGAMENTO", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${r.numeroRecibo}`, pageW / 2, y, { align: "center" });
  y += 8;

  // Caixa de valor em destaque
  doc.setDrawColor(60);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, "FD");
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("VALOR PAGO", margin + 4, y + 6);
  doc.setFontSize(14);
  doc.text(fmtBRL(r.valor), pageW - margin - 4, y + 9, { align: "right" });
  y += 20;

  // Bloco do beneficiário (quem recebe)
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("BENEFICIÁRIO (RECEBEDOR)", margin, y);
  y += 2;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${r.beneficiarioNome}`, margin + 2, y); y += 5;
  if (r.beneficiarioDocumento) {
    doc.text(`CPF/CNPJ: ${r.beneficiarioDocumento}`, margin + 2, y);
    y += 5;
  }
  y += 4;

  // Corpo
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const docTxt = r.beneficiarioDocumento ? `, portador(a) do documento ${r.beneficiarioDocumento},` : "";
  const corpo =
    `Eu, ${r.beneficiarioNome}${docTxt} declaro para os devidos fins ` +
    `que recebi de ${nomeEmpresa}${cnpj ? `, CNPJ ${cnpj}` : ""}, a importância de ` +
    `${fmtBRL(r.valor)} (${valorPorExtenso(r.valor)}), referente a "${r.descricao}", ` +
    `pago em ${formatarData(r.dataPagamento)} por meio de ${(r.formaPagamento ?? "—").toUpperCase()}, ` +
    `dando plena, geral e irrevogável quitação do valor ora recebido, ` +
    `para nada mais reclamar a qualquer tempo ou título.`;
  const linhas = doc.splitTextToSize(corpo, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 5.5 + 6;

  // Detalhes do pagamento
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("DETALHES DO PAGAMENTO", margin, y); y += 2;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const linhaKV = (k: string, v: string) => {
    doc.text(k, margin + 2, y);
    doc.text(v, pageW - margin - 2, y, { align: "right" });
    y += 5.5;
  };
  linhaKV("Descrição", r.descricao);
  if (r.categoria) linhaKV("Categoria", r.categoria);
  if (r.dataVencimento) linhaKV("Vencimento", formatarData(r.dataVencimento));
  linhaKV("Data do pagamento", formatarData(r.dataPagamento));
  linhaKV("Forma de pagamento", (r.formaPagamento ?? "—").toUpperCase());
  linhaKV("Valor", fmtBRL(r.valor));

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

  // Assinatura do beneficiário (quem recebeu deve assinar)
  y += 24;
  doc.setDrawColor(80);
  doc.line(pageW / 2 - 55, y, pageW / 2 + 55, y);
  y += 5;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(r.beneficiarioNome, pageW / 2, y, { align: "center" });
  if (r.beneficiarioDocumento) {
    y += 4;
    doc.setFont("times", "normal");
    doc.text(`CPF/CNPJ: ${r.beneficiarioDocumento}`, pageW / 2, y, { align: "center" });
  }
  y += 4;
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.text("(assinatura do beneficiário)", pageW / 2, y, { align: "center" });

  // Rodapé de autenticidade (hash + QR)
  if (autenticidade) {
    const boxH = 36;
    const boxY = pageH - 14 - boxH - 4;
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 1.5, 1.5, "S");

    const qrSize = 30;
    try {
      doc.addImage(autenticidade.qrDataUrl, "PNG", margin + 3, boxY + 3, qrSize, qrSize);
    } catch {}

    const txtX = margin + qrSize + 8;
    let ty = boxY + 6;
    doc.setTextColor(0);
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.text("CÓDIGO DE AUTENTICIDADE", txtX, ty);
    ty += 4;
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.text(`ID: ${autenticidade.id}`, txtX, ty);
    ty += 3.5;
    const hashLines = doc.splitTextToSize(
      `Hash SHA-256: ${autenticidade.hash}`,
      pageW - margin - txtX - 3
    );
    doc.text(hashLines, txtX, ty);
    ty += hashLines.length * 3.5;
    const urlLines = doc.splitTextToSize(
      `Verificar: ${autenticidade.urlVerificacao}`,
      pageW - margin - txtX - 3
    );
    doc.text(urlLines, txtX, ty);
    ty += urlLines.length * 3.5 + 1;
    doc.setTextColor(90);
    const aviso = doc.splitTextToSize(
      "Documento arquivado eletronicamente em conformidade com a LGPD (Lei 13.709/2018). Qualquer alteração no conteúdo invalidará o hash.",
      pageW - margin - txtX - 3
    );
    doc.text(aviso, txtX, ty);
    doc.setTextColor(0);
  }

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

  try {
    (doc as any).setEncryption?.("", "", ["print"], 128);
  } catch {}

  doc.save(`recibo-despesa-${r.numeroRecibo}.pdf`);
}