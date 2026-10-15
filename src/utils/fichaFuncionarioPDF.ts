import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { certificarPDF } from './certificarPDF';
import { formatarData, formatarDataHora, hojeISO } from "@/utils/dateUtils";

/**
 * Ficha funcional individual consolidada em PDF (A4 retrato):
 * dados pessoais, contrato/cargo, escala atual e histórico, desligamento/aviso,
 * advertências, afastamentos, folhas de ponto, contracheques e gamificação.
 */

/** Nome de arquivo seguro: ficha-funcionario-<nome>-<dd-mm-aaaa>.pdf */
export function nomeArquivoFichaFuncionario(nome: string, dataISO: string): string {
  const slug =
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "funcionario";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataISO);
  const data = m ? `${m[3]}-${m[2]}-${m[1]}` : "sem-data";
  return `ficha-funcionario-${slug}-${data}.pdf`;
}

const fmt = (d?: string | null) => (d ? formatarData(d) : "-");
const sn = (b?: boolean | null) => (b ? "Sim" : "Não");
const brl = (v?: number | null) =>
  v == null ? "-" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const VERDE: [number, number, number] = [19, 102, 63];

export async function exportarFichaFuncionarioPDF(funcionarioId: string) {
  const { data: f, error } = await supabase
    .from("funcionarios")
    .select("*, escalas(nome, entrada, saida, jornada_trabalho, intervalo_inicio, intervalo_fim), cargos(nome, cbo, salario_base, carga_horaria_semanal)")
    .eq("id", funcionarioId)
    .single();
  if (error || !f) throw error ?? new Error("Funcionário não encontrado");
  const func: any = f;

  const [hist, adv, afa, folhas, contra, gam] = await Promise.all([
    supabase.from("funcionarios_escalas_historico").select("data_inicio, data_fim, motivo, escalas(nome)").eq("funcionario_id", funcionarioId).order("data_inicio", { ascending: false }),
    supabase.from("advertencias_suspensoes").select("tipo, motivo, data_ocorrencia, dias_suspensao").eq("funcionario_id", funcionarioId).order("data_ocorrencia", { ascending: false }),
    supabase.from("afastamentos").select("data_inicio, data_fim, tipo_periodo, quantidade_dias, tipos_afastamento(descricao, remunerado)").eq("funcionario_id", funcionarioId).order("data_inicio", { ascending: false }),
    supabase.from("folhas_ponto").select("*").eq("funcionario_id", funcionarioId).order("ano", { ascending: false }).order("mes", { ascending: false }).limit(12),
    supabase.from("contracheques").select("*").eq("funcionario_id", funcionarioId).limit(12),
    supabase.from("gamification_profiles").select("*").eq("funcionario_id", funcionarioId).maybeSingle(),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(...VERDE);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FICHA FUNCIONAL", 14, 11);
  doc.setFontSize(11);
  doc.text(func.nome_completo, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Situação: ${func.ativo ? "Ativo" : "Desligado"}`, pageW - 14, 11, { align: "right" });
  doc.text(`Emitido em ${formatarDataHora(new Date().toISOString())} (Brasília)`, pageW - 14, 18, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = 30;
  const secao = (titulo: string, body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [[titulo, ""]],
      body: body.map((r) => r.map(String)),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: VERDE },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  };
  const tabela = (titulo: string, head: string[], body: (string | number)[][], vazio: string) => {
    autoTable(doc, {
      startY: y,
      head: [[{ content: titulo, colSpan: head.length }], head],
      body: body.length ? body.map((r) => r.map(String)) : [[{ content: vazio, colSpan: head.length, styles: { textColor: 120, fontStyle: "italic" } }]] as any,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: VERDE },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  };

  secao("Dados pessoais", [
    ["CPF", func.cpf || "-"],
    ["E-mail", func.email || "-"],
    ["Telefone", func.telefone || "-"],
    ["Data de nascimento", fmt(func.data_nascimento)],
  ]);
  secao("Dados contratuais", [
    ["Cargo / Função", func.cargos?.nome || func.funcao || "-"],
    ["CBO", func.cargos?.cbo || "-"],
    ["Salário base do cargo", brl(func.cargos?.salario_base)],
    ["Carga horária semanal", func.cargos?.carga_horaria_semanal ? `${func.cargos.carga_horaria_semanal} h` : "-"],
    ["Data de admissão", fmt(func.data_admissao)],
    ["Início de vigência", fmt(func.data_inicio_vigencia)],
    ["Registra ponto", sn(func.registra_ponto)],
    ["Biometria facial", func.biometria_cadastrada_em ? `Cadastrada em ${fmt(func.biometria_cadastrada_em)}` : "Não cadastrada"],
    ["Vale-transporte", func.recebe_vale_transporte ? `Sim — ${brl(func.valor_diaria_vale_transporte)}/dia` : "Não"],
  ]);
  secao("Escala atual", [
    ["Escala", func.escalas?.nome || "Sem escala registrada"],
    ["Jornada", func.escalas?.jornada_trabalho || "-"],
    ["Entrada / Saída", func.escalas ? `${func.escalas.entrada || "-"} às ${func.escalas.saida || "-"}` : "-"],
    ["Intervalo", func.escalas?.intervalo_inicio ? `${func.escalas.intervalo_inicio} às ${func.escalas.intervalo_fim || "-"}` : "-"],
  ]);
  if (func.aviso_previo || func.data_desligamento) {
    secao("Aviso prévio / Desligamento", [
      ["Aviso prévio", func.aviso_previo ? `${func.tipo_aviso_previo || "-"} (${fmt(func.data_inicio_aviso)} a ${fmt(func.data_fim_aviso)})` : "Não"],
      ["Redução do aviso", func.modalidade_reducao_aviso || "-"],
      ["Data de desligamento", fmt(func.data_desligamento)],
      ["Motivo", func.motivo_desligamento || "-"],
      ["Observações", func.observacoes_desligamento || "-"],
    ]);
  }

  tabela("Histórico de escalas", ["Escala", "Início", "Fim", "Motivo"],
    (hist.data || []).map((h: any) => [h.escalas?.nome || "-", fmt(h.data_inicio), h.data_fim ? fmt(h.data_fim) : "Atual", h.motivo || "-"]),
    "Nenhum período registrado.");
  tabela("Advertências e suspensões", ["Tipo", "Motivo", "Data", "Dias susp."],
    (adv.data || []).map((a: any) => [a.tipo, a.motivo, fmt(a.data_ocorrencia), a.dias_suspensao || "-"]),
    "Nenhuma ocorrência disciplinar.");
  tabela("Afastamentos", ["Tipo", "Remunerado", "Início", "Fim", "Dias"],
    (afa.data || []).map((a: any) => [a.tipos_afastamento?.descricao || "-", sn(a.tipos_afastamento?.remunerado), fmt(a.data_inicio), fmt(a.data_fim), a.quantidade_dias || "-"]),
    "Nenhum afastamento.");
  tabela("Folhas de ponto (últimas 12)", ["Competência", "Situação"],
    (folhas.data || []).map((p: any) => [`${String(p.mes).padStart(2, "0")}/${p.ano}`, p.confirmado ? "Confirmada" : p.motivo_discordancia ? "Contestada" : "Pendente"]),
    "Nenhuma folha publicada.");
  tabela("Contracheques", ["Competência", "Publicado em"],
    (contra.data || []).map((c: any) => [c.mes && c.ano ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : c.competencia || "-", c.created_at ? fmt(c.created_at) : "-"]),
    "Nenhum contracheque publicado.");
  const g: any = gam.data;
  if (g) secao("Gamificação", [["Nível", g.nivel || "-"], ["XP total", g.xp_total ?? g.xp ?? 0], ["Moedas", g.moedas ?? g.saldo_moedas ?? 0]]);

  // Certificação de autenticidade: registra o conteúdo consolidado e gera código + SHA-256.
  await certificarPDF(doc, { tipo: 'ficha_funcional', titulo: `Ficha funcional — ${func.nome_completo}`, referenciaId: func.id, referenciaTabela: 'funcionarios', tenantId: func.tenant_id }, y);

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text("SenexCare • Documento de uso interno — contém dados pessoais protegidos pela LGPD", 14, pageH - 7);
    doc.text(`Página ${i} de ${total}`, pageW - 14, pageH - 7, { align: "right" });
  }

  doc.save(nomeArquivoFichaFuncionario(func.nome_completo, hojeISO()));
}

