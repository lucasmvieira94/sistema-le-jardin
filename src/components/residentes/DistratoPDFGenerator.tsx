/**
 * Visualização do distrato: mesmo padrão do contrato (Times New Roman, certificação SXCare),
 * com Imprimir, Enviar para assinatura e Baixar PDF.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileDown, Printer, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hojeExtenso, formatarDataExtenso, formatarData } from "@/utils/dateUtils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ContratoData, ResidenteData, EmpresaData } from "./types";
import type { DistratoData } from "./DistratoForm";
import { rotuloTipo, clausulaTipo } from "@/utils/distratoContrato";
import { useDocumentoAutenticidade, rodapeAutenticidadeHTML, type DocumentoAutenticidade } from "@/hooks/useDocumentoAutenticidade";
import EnviarParaAssinaturaButton from "@/components/assinaturas/EnviarParaAssinaturaButton";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  distrato: DistratoData;
  contrato: ContratoData;
  residente: ResidenteData;
  empresa?: EmpresaData;
}

const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const ESTILO = `
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 20px 50px; }
  .header { text-align: center; margin-bottom: 16px; }
  .header h1 { font-size: 13pt; margin: 0; }
  h2 { font-size: 13pt; text-align: center; margin: 14px 0; text-transform: uppercase; }
  h3 { font-size: 11pt; margin: 14px 0 6px; text-transform: uppercase; }
  p { text-align: justify; margin: 0 0 6px; }
  table.v { width: 100%; border-collapse: collapse; margin: 6px 0; }
  table.v td { border: 1px solid #000; padding: 3px 6px; font-size: 10.5pt; }
  .data-local { text-align: right; margin: 20px 0; }
  .assinatura-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .assinatura-item { text-align: center; width: 45%; }
  .assinatura-linha { border-top: 1px solid #000; padding-top: 4px; font-size: 10pt; }
  @media print { body { padding: 15px 40px; } }
`;

export default function DistratoPDFGenerator({ open, onOpenChange, distrato, contrato, residente, empresa }: Props) {
  const { toast } = useToast();
  const { registrar, loading } = useDocumentoAutenticidade();
  const [auth, setAuth] = useState<DocumentoAutenticidade | null>(null);
  const [cfg, setCfg] = useState<{ nome_empresa: string; cnpj: string | null; logo_url: string | null; cidade: string | null; endereco: string | null } | null>(null);

  useEffect(() => {
    if (!open) { setAuth(null); return; }
    supabase.from("configuracoes_empresa").select("nome_empresa, cnpj, logo_url, cidade, endereco").limit(1).single()
      .then(({ data }) => data && setCfg(data));
    let cancel = false;
    registrar({
      tipo: "distrato_residente",
      referencia_id: distrato.id,
      referencia_tabela: "contratos_distratos",
      numero_documento: distrato.numero_distrato,
      titular_nome: residente.nome_completo,
      dados_estruturais: {
        numero: distrato.numero_distrato,
        contrato: contrato.numero_contrato,
        tipo: distrato.tipo_rescisao,
        data_distrato: distrato.data_distrato,
        data_efetiva: distrato.data_efetiva,
        valor_total: distrato.valor_total,
        contratante: { nome: contrato.contratante_nome, cpf: contrato.contratante_cpf ?? null },
        residente: { nome: residente.nome_completo, cpf: residente.cpf ?? null },
      },
    })
      .then((r) => !cancel && setAuth(r))
      .catch(() => toast({ title: "Aviso", description: "Não foi possível certificar o distrato. Impressão e download ficam bloqueados.", variant: "destructive" }));
    return () => { cancel = true; };
  }, [open, distrato.id]);

  const gerarHTML = () => {
    const nome = cfg?.nome_empresa || empresa?.nome_empresa || "EMPRESA";
    const cnpj = cfg?.cnpj || empresa?.cnpj || "";
    const endereco = cfg?.endereco || empresa?.endereco || "";
    const cidade = cfg?.cidade || "";
    const d = distrato;
    const linhas: string[] = [];
    if (Number(d.valor_proporcional)) linhas.push(`<tr><td>${d.tipo_rescisao === "acordo" ? "Valor acordado" : d.tipo_rescisao === "falecimento" ? "Mensalidade do mês do falecimento" : "Mensalidade proporcional até o encerramento"}</td><td>${moeda(d.valor_proporcional)}</td></tr>`);
    if (Number(d.valor_indenizacao)) linhas.push(`<tr><td>Indenização por descumprimento do aviso prévio (Cl. 6.1), devida pela ${d.parte_iniciadora.toUpperCase()}</td><td>${moeda(d.valor_indenizacao)}</td></tr>`);
    if (Number(d.valor_adaptacao)) linhas.push(`<tr><td>Período de adaptação (R$ 250,00/dia)</td><td>${moeda(d.valor_adaptacao)}</td></tr>`);
    (d.valores_pendentes || []).forEach((p) => linhas.push(`<tr><td>Mensalidade em aberto — competência ${formatarData(p.competencia)}</td><td>${moeda(p.valor)}</td></tr>`));
    const total = Number(d.valor_total);
    linhas.push(`<tr><td><strong>${total >= 0 ? "TOTAL DEVIDO PELO CONTRATANTE" : "TOTAL A RESTITUIR AO CONTRATANTE"}</strong></td><td><strong>${moeda(Math.abs(total))}</strong></td></tr>`);

    const fundamento = d.tipo_rescisao === "acordo"
      ? `<p>As partes, de comum acordo, ajustam as seguintes condições para o encerramento do contrato:</p><p>${esc(d.condicao_livre || "").replace(/\n/g, "<br/>")}</p>`
      : `<p>O presente distrato fundamenta-se na <strong>${clausulaTipo(d.tipo_rescisao)}</strong> do contrato — ${rotuloTipo(d.tipo_rescisao)}.${d.tipo_rescisao === "aviso_previo" ? ` Comunicada a rescisão em ${formatarDataExtenso(d.data_distrato)}, cumpre-se o aviso prévio de 30 (trinta) dias.` : ""}</p>`;

    return `
      <div class="header">
        ${cfg?.logo_url ? `<img src="${cfg.logo_url}" style="max-height:60px;margin:0 auto 8px;display:block;" />` : ""}
        <h1>${nome}</h1>${cnpj ? `<div>CNPJ: ${cnpj}</div>` : ""}${endereco ? `<div>${endereco}</div>` : ""}
      </div>
      <h2>Instrumento Particular de Distrato<br/>Contrato de Prestação de Serviços nº ${contrato.numero_contrato}</h2>
      <p><strong>CONTRATADA:</strong> ${nome}${cnpj ? `, inscrita no CNPJ sob o nº ${cnpj}` : ""}${endereco ? `, com sede em ${endereco}` : ""}.</p>
      <p><strong>CONTRATANTE:</strong> ${esc(contrato.contratante_nome)}${contrato.contratante_cpf ? `, CPF ${contrato.contratante_cpf}` : ""}${contrato.contratante_rg ? `, RG ${contrato.contratante_rg}` : ""}${contrato.contratante_endereco ? `, residente em ${esc(contrato.contratante_endereco)}${contrato.contratante_cidade ? `, ${esc(contrato.contratante_cidade)}/${contrato.contratante_estado || ""}` : ""}` : ""}.</p>
      <p><strong>RESIDENTE:</strong> ${esc(residente.nome_completo)}${residente.cpf ? `, CPF ${residente.cpf}` : ""}, prontuário nº ${residente.numero_prontuario}.</p>
      <p>As partes acima qualificadas resolvem, por este instrumento, distratar o Contrato de Prestação de Serviços nº ${contrato.numero_contrato}, firmado em ${formatarDataExtenso(contrato.data_inicio_contrato)}, nos termos a seguir.</p>
      <h3>Cláusula Primeira — Do fundamento</h3>
      ${fundamento}
      <h3>Cláusula Segunda — Do encerramento</h3>
      <p>A prestação dos serviços encerra-se em <strong>${formatarDataExtenso(d.data_efetiva)}</strong>, data em que o residente deverá ser desligado da instituição, cessando todas as obrigações futuras entre as partes.</p>
      <h3>Cláusula Terceira — Dos valores</h3>
      <table class="v">${linhas.join("")}</table>
      ${d.retem_garantia ? `<p>Conforme a Cláusula 2.10 do contrato, não haverá restituição do valor pago a título de garantia.</p>` : ""}
      <p>Os valores acima deverão ser quitados até a data de encerramento, salvo ajuste diverso entre as partes.</p>
      ${d.observacoes ? `<h3>Cláusula Quarta — Observações</h3><p>${esc(d.observacoes).replace(/\n/g, "<br/>")}</p>` : ""}
      <h3>${d.observacoes ? "Cláusula Quinta" : "Cláusula Quarta"} — Da quitação</h3>
      <p>Cumpridas as obrigações deste instrumento, as partes dão-se mútua, plena e geral quitação quanto ao contrato distratado, nada mais tendo a reclamar uma da outra, a qualquer título.</p>
      <p class="data-local">${cidade ? `${cidade}, ` : ""}${hojeExtenso()}.</p>
      <div class="assinatura-row">
        <div class="assinatura-item"><div class="assinatura-linha">${nome}<br/>CONTRATADA</div></div>
        <div class="assinatura-item"><div class="assinatura-linha">${esc(contrato.contratante_nome)}<br/>CONTRATANTE</div></div>
      </div>`;
  };

  const htmlFinal = () => gerarHTML() + (auth ? rodapeAutenticidadeHTML(auth) : "");

  const imprimir = () => {
    if (!auth) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Distrato ${distrato.numero_distrato}</title><style>${ESTILO}</style></head><body>${htmlFinal()}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const baixar = async () => {
    if (!auth) return;
    try {
      const m = 20, larguraMm = 170;
      const box = document.createElement("div");
      Object.assign(box.style, { position: "absolute", left: "-9999px", top: "0", width: `${larguraMm}mm`, background: "#fff", color: "#000" });
      box.innerHTML = `<style>${ESTILO.replace("padding: 20px 50px;", "")}</style><div style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.5">${htmlFinal()}</div>`;
      document.body.appendChild(box);
      const canvas = await html2canvas(box, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      document.body.removeChild(box);
      const pdf = new jsPDF("p", "mm", "a4");
      pdf.setDocumentProperties({ title: `Distrato ${distrato.numero_distrato}`, creator: "Senex Care", keywords: `distrato,hash:${auth.hash}` });
      const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
      const rw = W - 2 * m, rh = canvas.height * (rw / canvas.width), util = H - 2 * m;
      const img = canvas.toDataURL("image/png");
      for (let pos = 0, pg = 0; pos < rh; pos += util, pg++) {
        if (pg) pdf.addPage();
        pdf.addImage(img, "PNG", m, m - pos, rw, rh);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, W, m, "F");
        pdf.rect(0, H - m, W, m, "F");
      }
      pdf.save(`Distrato_${contrato.numero_contrato.replace(/\//g, "-")}_${residente.nome_completo.split(" ")[0]}.pdf`);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar PDF", description: "Use Imprimir para salvar como PDF.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Distrato {distrato.numero_distrato}</span>
            <div className="flex flex-wrap gap-2">
              {loading && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Registrando autenticidade…</span>}
              {auth && <span className="text-xs text-primary flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Autenticidade registrada</span>}
              <Button variant="outline" size="sm" onClick={imprimir} disabled={!auth}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
              <EnviarParaAssinaturaButton
                titulo={`Distrato ${distrato.numero_distrato} — ${residente.nome_completo}`}
                tipo="distrato_residente"
                referenciaId={distrato.id}
                referenciaTabela="contratos_distratos"
                label="Enviar para assinatura"
                obterConteudoHtml={htmlFinal}
                signatarios={[{
                  nome: contrato.contratante_nome,
                  cpf: contrato.contratante_cpf ?? null,
                  email: contrato.contratante_email ?? null,
                  telefone: contrato.contratante_telefone ?? null,
                  papel: "responsavel",
                  metodo: contrato.contratante_email ? "otp_email" : "otp_sms",
                }]}
              />
              <Button size="sm" onClick={baixar} disabled={!auth}><FileDown className="w-4 h-4 mr-2" />Baixar PDF</Button>
            </div>
          </DialogTitle>
          <DialogDescription>Visualize, imprima, envie para assinatura ou baixe o distrato.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto border rounded-lg bg-muted p-4">
          <div className="bg-white text-black p-8 max-w-4xl mx-auto border rounded shadow-sm"
            style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "11pt", lineHeight: "1.5" }}
            dangerouslySetInnerHTML={{ __html: `<style>${ESTILO.replace(/body \{[^}]*\}/, "")}</style>` + htmlFinal() }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
