import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { formatarData, hojeISO } from "@/utils/dateUtils";

/**
 * Exporta a Ficha Funcional completa de funcionários (PDF e Excel).
 */

export type FiltroExport = "todos" | "ativos" | "inativos" | "selecionados";

interface FuncionarioFicha {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string | null;
  funcao: string;
  data_nascimento: string;
  data_admissao: string;
  data_inicio_vigencia: string | null;
  ativo: boolean;
  registra_ponto: boolean;
  acesso_supervisor: boolean;
  recebe_vale_transporte: boolean;
  valor_diaria_vale_transporte: number | null;
  codigo_4_digitos: string;
  escalas?: {
    nome: string;
    entrada: string;
    saida: string;
    jornada_trabalho: string;
    intervalo_inicio: string | null;
    intervalo_fim: string | null;
  } | null;
}

async function buscarFuncionarios(
  filtro: FiltroExport,
  ids?: string[],
): Promise<FuncionarioFicha[]> {
  let query = supabase
    .from("funcionarios")
    .select(
      `id, nome_completo, cpf, email, telefone, funcao, data_nascimento,
       data_admissao, data_inicio_vigencia, ativo, registra_ponto,
       acesso_supervisor, recebe_vale_transporte, valor_diaria_vale_transporte,
       codigo_4_digitos,
       escalas(nome, entrada, saida, jornada_trabalho, intervalo_inicio, intervalo_fim)`,
    )
    .order("nome_completo");

  if (filtro === "ativos") query = query.eq("ativo", true);
  else if (filtro === "inativos") query = query.eq("ativo", false);
  else if (filtro === "selecionados" && ids?.length) {
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as FuncionarioFicha[];
}

async function buscarAdvertencias(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("advertencias_suspensoes")
    .select("funcionario_id, tipo, motivo, data_ocorrencia, dias_suspensao")
    .in("funcionario_id", ids)
    .order("data_ocorrencia", { ascending: false });
  return data || [];
}

async function buscarAfastamentos(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("afastamentos")
    .select(
      "funcionario_id, data_inicio, data_fim, tipo_periodo, quantidade_dias, observacoes, tipos_afastamento(descricao, remunerado)",
    )
    .in("funcionario_id", ids)
    .order("data_inicio", { ascending: false });
  return (data || []) as any[];
}

const fmt = (d?: string | null) => (d ? formatarData(d) : "-");
const sn = (b: boolean | null | undefined) => (b ? "Sim" : "Não");

/* =========================== EXCEL =========================== */

export async function exportarFichaExcel(filtro: FiltroExport, ids?: string[]) {
  const funcionarios = await buscarFuncionarios(filtro, ids);
  if (!funcionarios.length) throw new Error("Nenhum funcionário encontrado");

  const idsAll = funcionarios.map((f) => f.id);
  const [advertencias, afastamentos] = await Promise.all([
    buscarAdvertencias(idsAll),
    buscarAfastamentos(idsAll),
  ]);

  const linhasFicha = funcionarios.map((f) => ({
    Nome: f.nome_completo,
    CPF: f.cpf,
    "E-mail": f.email,
    Telefone: f.telefone || "-",
    Função: f.funcao,
    "Data Nascimento": fmt(f.data_nascimento),
    "Data Admissão": fmt(f.data_admissao),
    "Início Vigência": fmt(f.data_inicio_vigencia),
    Status: f.ativo ? "Ativo" : "Desligado",
    "Código (PIN)": f.codigo_4_digitos,
    "Registra Ponto": sn(f.registra_ponto),
    "Acesso Supervisor": sn(f.acesso_supervisor),
    "Recebe Vale-Transporte": sn(f.recebe_vale_transporte),
    "Valor Diária VT": f.valor_diaria_vale_transporte ?? 0,
    Escala: f.escalas?.nome || "-",
    Jornada: f.escalas?.jornada_trabalho || "-",
    Entrada: f.escalas?.entrada || "-",
    Saída: f.escalas?.saida || "-",
    "Intervalo Início": f.escalas?.intervalo_inicio || "-",
    "Intervalo Fim": f.escalas?.intervalo_fim || "-",
  }));

  const linhasAdv = advertencias.map((a: any) => {
    const f = funcionarios.find((x) => x.id === a.funcionario_id);
    return {
      Funcionário: f?.nome_completo || "-",
      Tipo: a.tipo,
      Motivo: a.motivo,
      "Data Ocorrência": fmt(a.data_ocorrencia),
      "Dias Suspensão": a.dias_suspensao || 0,
    };
  });

  const linhasAfa = afastamentos.map((a: any) => {
    const f = funcionarios.find((x) => x.id === a.funcionario_id);
    return {
      Funcionário: f?.nome_completo || "-",
      Tipo: a.tipos_afastamento?.descricao || "-",
      Remunerado: sn(a.tipos_afastamento?.remunerado),
      "Data Início": fmt(a.data_inicio),
      "Data Fim": fmt(a.data_fim),
      Período: a.tipo_periodo,
      Dias: a.quantidade_dias || 0,
      Observações: a.observacoes || "-",
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasFicha), "Ficha Funcional");
  if (linhasAdv.length)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasAdv), "Advertências");
  if (linhasAfa.length)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasAfa), "Afastamentos");

  XLSX.writeFile(wb, `ficha_funcional_${filtro}_${hojeISO()}.xlsx`);
}

/* ============================ PDF ============================ */

export async function exportarFichaPDF(filtro: FiltroExport, ids?: string[]) {
  const funcionarios = await buscarFuncionarios(filtro, ids);
  if (!funcionarios.length) throw new Error("Nenhum funcionário encontrado");

  const idsAll = funcionarios.map((f) => f.id);
  const [advertencias, afastamentos] = await Promise.all([
    buscarAdvertencias(idsAll),
    buscarAfastamentos(idsAll),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  funcionarios.forEach((f, idx) => {
    if (idx > 0) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Ficha Funcional", pageW / 2, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(f.nome_completo, pageW / 2, 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Status: ${f.ativo ? "Ativo" : "Desligado"}  •  Emitido em ${formatarData(hojeISO())}`,
      pageW / 2,
      28,
      { align: "center" },
    );

    autoTable(doc, {
      startY: 34,
      head: [["Dados Pessoais", ""]],
      body: [
        ["CPF", f.cpf],
        ["E-mail", f.email],
        ["Telefone", f.telefone || "-"],
        ["Data de nascimento", fmt(f.data_nascimento)],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    });

    autoTable(doc, {
      head: [["Dados Funcionais", ""]],
      body: [
        ["Função", f.funcao],
        ["Data de admissão", fmt(f.data_admissao)],
        ["Início de vigência", fmt(f.data_inicio_vigencia)],
        ["Código (PIN)", f.codigo_4_digitos],
        ["Registra ponto", sn(f.registra_ponto)],
        ["Acesso supervisor", sn(f.acesso_supervisor)],
        ["Recebe vale-transporte", sn(f.recebe_vale_transporte)],
        [
          "Valor diária VT",
          (f.valor_diaria_vale_transporte ?? 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
        ],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    });

    autoTable(doc, {
      head: [["Escala", ""]],
      body: [
        ["Nome", f.escalas?.nome || "-"],
        ["Jornada", f.escalas?.jornada_trabalho || "-"],
        ["Entrada / Saída", `${f.escalas?.entrada || "-"} - ${f.escalas?.saida || "-"}`],
        [
          "Intervalo",
          f.escalas?.intervalo_inicio
            ? `${f.escalas.intervalo_inicio} - ${f.escalas.intervalo_fim || "-"}`
            : "-",
        ],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    });

    const advs = advertencias.filter((a: any) => a.funcionario_id === f.id);
    if (advs.length) {
      autoTable(doc, {
        head: [["Advertências / Suspensões", "", "", ""]],
        body: [],
        theme: "plain",
        styles: { fontSize: 10, fontStyle: "bold", textColor: [220, 38, 38] },
      });
      autoTable(doc, {
        head: [["Tipo", "Motivo", "Data", "Dias Susp."]],
        body: advs.map((a: any) => [
          a.tipo,
          a.motivo,
          fmt(a.data_ocorrencia),
          a.dias_suspensao || "-",
        ]),
        theme: "striped",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
      });
    }

    const afas = afastamentos.filter((a: any) => a.funcionario_id === f.id);
    if (afas.length) {
      autoTable(doc, {
        head: [["Afastamentos", "", "", "", ""]],
        body: [],
        theme: "plain",
        styles: { fontSize: 10, fontStyle: "bold", textColor: [180, 120, 0] },
      });
      autoTable(doc, {
        head: [["Tipo", "Período", "Início", "Fim", "Dias"]],
        body: afas.map((a: any) => [
          a.tipos_afastamento?.descricao || "-",
          a.tipo_periodo,
          fmt(a.data_inicio),
          fmt(a.data_fim),
          a.quantidade_dias || "-",
        ]),
        theme: "striped",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [234, 179, 8] },
      });
    }
  });

  const total = funcionarios.length;
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalPages}  •  ${total} funcionário(s)`,
      pageW - 15,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  doc.save(`ficha_funcional_${filtro}_${hojeISO()}.pdf`);
}
