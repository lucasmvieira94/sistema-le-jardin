import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bus, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularDiasTrabalhados, calcularUltimoDiaVT, nomeMes } from "@/utils/valeTransporteCalculator";
import { toast } from "@/components/ui/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ModalValeTransporteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FuncionarioVT {
  id: string;
  nome_completo: string;
  funcao: string;
  recebe_vale_transporte: boolean;
  valor_diaria_vale_transporte: number | null;
  data_admissao: string | null;
  data_inicio_vigencia: string | null;
  data_desligamento: string | null;
  aviso_previo: boolean | null;
  tipo_aviso_previo: string | null;
  modalidade_reducao_aviso: string | null;
  data_inicio_aviso: string | null;
  data_fim_aviso: string | null;
  escala_id: number | null;
  escala?: { nome: string; jornada_trabalho: string } | null;
}

interface LinhaRelatorio {
  id: string;
  nome: string;
  funcao: string;
  escala: string;
  jornada: string;
  dias: number;
  diasCalculados: number;
  valorDiaria: number;
  total: number;
  observacao?: string;
}

function getProximoMes(): { mes: number; ano: number } {
  const hoje = new Date();
  const proxMes = hoje.getMonth() + 2; // +1 para 1-12, +1 para próximo
  if (proxMes > 12) return { mes: 1, ano: hoje.getFullYear() + 1 };
  return { mes: proxMes, ano: hoje.getFullYear() };
}

export default function ModalValeTransporte({ open, onOpenChange }: ModalValeTransporteProps) {
  const padrao = getProximoMes();
  const [mes, setMes] = useState<number>(padrao.mes);
  const [ano, setAno] = useState<number>(padrao.ano);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  // Ajustes manuais de dias por funcionário (chave: id do funcionário)
  const [diasManuais, setDiasManuais] = useState<Record<string, number>>({});

  // Limpa ajustes ao trocar o período de referência
  React.useEffect(() => {
    setDiasManuais({});
  }, [mes, ano]);

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ["funcionarios-vt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id, nome_completo, funcao, recebe_vale_transporte, valor_diaria_vale_transporte, data_admissao, data_inicio_vigencia, data_desligamento, aviso_previo, tipo_aviso_previo, modalidade_reducao_aviso, data_inicio_aviso, data_fim_aviso, escala_id, escala:escalas(nome, jornada_trabalho)"
        )
        .eq("recebe_vale_transporte", true)
        .order("nome_completo");
      if (error) throw error;
      // Inclui ativos + desligados cuja data de desligamento cai no/após o mês de referência
      const lista = (data || []) as unknown as FuncionarioVT[];
      return lista;
    },
    enabled: open,
  });

  const linhas = useMemo<LinhaRelatorio[]>(() => {
    if (!funcionarios) return [];
    const primeiroDia = new Date(ano, mes - 1, 1);
    return funcionarios
      .filter((f) => {
        // Último dia com direito a VT (considera aviso prévio); se anterior ao mês, ignora
        const ultimoDia = calcularUltimoDiaVT({
          ano,
          mes,
          jornada: "",
          dataDesligamento: f.data_desligamento,
          avisoPrevio: f.aviso_previo,
          tipoAvisoPrevio: f.tipo_aviso_previo,
          modalidadeReducaoAviso: f.modalidade_reducao_aviso,
          dataInicioAviso: f.data_inicio_aviso,
          dataFimAviso: f.data_fim_aviso,
        });
        if (ultimoDia && ultimoDia < primeiroDia) return false;
        return true;
      })
      .map((f) => {
      const jornada = f.escala?.jornada_trabalho || "40h_8h_segsex";
      const dias = calcularDiasTrabalhados({
        ano,
        mes,
        jornada,
        dataInicioVigencia: f.data_inicio_vigencia,
        dataAdmissao: f.data_admissao,
        dataDesligamento: f.data_desligamento,
        avisoPrevio: f.aviso_previo,
        tipoAvisoPrevio: f.tipo_aviso_previo,
        modalidadeReducaoAviso: f.modalidade_reducao_aviso,
        dataInicioAviso: f.data_inicio_aviso,
        dataFimAviso: f.data_fim_aviso,
      });
      const valorDiaria = Number(f.valor_diaria_vale_transporte || 0);
      const ultimoDiaVT = calcularUltimoDiaVT({
        ano,
        mes,
        jornada,
        dataDesligamento: f.data_desligamento,
        avisoPrevio: f.aviso_previo,
        tipoAvisoPrevio: f.tipo_aviso_previo,
        modalidadeReducaoAviso: f.modalidade_reducao_aviso,
        dataInicioAviso: f.data_inicio_aviso,
        dataFimAviso: f.data_fim_aviso,
      });
      return {
        id: f.id,
        nome: f.nome_completo,
        funcao: f.funcao,
        escala: f.escala?.nome || "—",
        jornada,
        dias: diasManuais[f.id] ?? dias,
        diasCalculados: dias,
        valorDiaria,
        total: (diasManuais[f.id] ?? dias) * valorDiaria,
        observacao:
          f.aviso_previo && ultimoDiaVT
            ? `Aviso prévio${f.tipo_aviso_previo ? ` (${f.tipo_aviso_previo})` : ""} — VT até ${ultimoDiaVT.toLocaleDateString("pt-BR")}`
            : undefined,
      };
    })
    .filter((l) => l.diasCalculados > 0 || l.dias > 0);
  }, [funcionarios, mes, ano, diasManuais]);

  const totais = useMemo(() => {
    return linhas.reduce(
      (acc, l) => ({ dias: acc.dias + l.dias, valor: acc.valor + l.total }),
      { dias: 0, valor: 0 }
    );
  }, [linhas]);

  const tituloPeriodo = `${nomeMes(mes)}/${ano}`;

  function exportarPDF() {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "portrait" });
      doc.setFontSize(16);
      doc.text("Relatório de Vale-Transporte", 14, 18);
      doc.setFontSize(11);
      doc.text(`Período de referência: ${tituloPeriodo}`, 14, 26);
      doc.text(`Pagamento referente ao mês: ${tituloPeriodo}`, 14, 32);

      autoTable(doc, {
        startY: 38,
        head: [["Funcionário", "Função", "Escala", "Dias", "Valor diária", "Total"]],
        body: linhas.map((l) => [
          l.observacao ? `${l.nome} (${l.observacao})` : l.nome,
          l.funcao,
          l.escala,
          String(l.dias),
          l.valorDiaria.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          l.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        ]),
        foot: [[
          "TOTAL", "", "",
          String(totais.dias),
          "",
          totais.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        ]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [229, 231, 235], textColor: 0, fontStyle: "bold" },
      });

      doc.save(`vale-transporte-${tituloPeriodo.replace("/", "-")}.pdf`);
      toast({ title: "PDF gerado com sucesso" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: e?.message });
    } finally {
      setExporting(null);
    }
  }

  function exportarExcel() {
    setExporting("excel");
    try {
      const ws = XLSX.utils.json_to_sheet(
        linhas.map((l) => ({
          Funcionário: l.nome,
          Função: l.funcao,
          Escala: l.escala,
          Dias: l.dias,
          "Valor diária (R$)": l.valorDiaria,
          "Total (R$)": l.total,
          Observação: l.observacao || "",
        }))
      );
      XLSX.utils.sheet_add_aoa(ws, [["", "", "TOTAL", totais.dias, "", totais.valor]], {
        origin: -1,
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `VT ${tituloPeriodo}`);
      XLSX.writeFile(wb, `vale-transporte-${tituloPeriodo.replace("/", "-")}.xlsx`);
      toast({ title: "Excel gerado com sucesso" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar Excel", description: e?.message });
    } finally {
      setExporting(null);
    }
  }

  const anos = [ano - 1, ano, ano + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="w-5 h-5" /> Relatório de Vale-Transporte
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Mês de referência</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{nomeMes(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Cálculo baseado na escala vigente de cada funcionário. O período padrão é o mês seguinte ao atual,
          para preparar o pagamento antecipado do vale-transporte. Você pode ajustar manualmente a
          quantidade de dias de cada funcionário antes de exportar.
        </p>
        {Object.keys(diasManuais).length > 0 && (
          <div className="flex justify-end -mt-2">
            <Button variant="ghost" size="sm" onClick={() => setDiasManuais({})}>
              Restaurar dias calculados
            </Button>
          </div>
        )}

        <div className="border rounded-lg overflow-auto max-h-[400px]">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : linhas.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum funcionário ativo recebe vale-transporte.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Funcionário</th>
                  <th className="p-2 text-left">Escala</th>
                  <th className="p-2 text-right">Dias</th>
                  <th className="p-2 text-right">Valor diária</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">
                      {l.nome}
                      <div className="text-xs text-muted-foreground">{l.funcao}</div>
                      {l.observacao && (
                        <div className="text-xs text-amber-600 font-medium">{l.observacao}</div>
                      )}
                    </td>
                    <td className="p-2">{l.escala}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={31}
                        value={l.dias}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(31, Number(e.target.value) || 0));
                          setDiasManuais((prev) => ({ ...prev, [l.id]: v }));
                        }}
                        className="w-20 h-8 text-right ml-auto"
                        aria-label={`Dias de vale-transporte de ${l.nome}`}
                      />
                      {l.dias !== l.diasCalculados && (
                        <div className="text-[10px] text-amber-600 mt-1">
                          calc.: {l.diasCalculados}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {l.valorDiaria.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {l.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted font-semibold">
                <tr>
                  <td className="p-2" colSpan={2}>Totais</td>
                  <td className="p-2 text-right">{totais.dias}</td>
                  <td></td>
                  <td className="p-2 text-right">
                    {totais.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={exportarExcel} disabled={!!exporting || linhas.length === 0}>
            {exporting === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Exportar Excel
          </Button>
          <Button onClick={exportarPDF} disabled={!!exporting || linhas.length === 0}>
            {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Exportar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}