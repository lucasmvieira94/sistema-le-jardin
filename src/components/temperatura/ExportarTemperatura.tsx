import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, FileText, FileSpreadsheet } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTemperatura } from "@/hooks/useTemperatura";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";

const formSchema = z.object({
  periodo: z.enum(["mes_atual", "mes_anterior", "personalizado"]),
  dataInicio: z.date().optional(),
  dataFim: z.date().optional(),
}).refine((data) => {
  if (data.periodo === "personalizado") {
    return data.dataInicio && data.dataFim;
  }
  return true;
}, {
  message: "Selecione as datas de início e fim para período personalizado",
  path: ["dataInicio"]
});

type FormData = z.infer<typeof formSchema>;

export function ExportarTemperatura() {
  const [isExporting, setIsExporting] = useState(false);
  const { buscarRegistrosPorPeriodo } = useTemperatura();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodo: "mes_atual",
    },
  });

  const getDatesFromPeriod = (periodo: string, dataInicio?: Date, dataFim?: Date) => {
    const hoje = new Date();
    
    switch (periodo) {
      case "mes_atual":
        return {
          inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
          fim: format(endOfMonth(hoje), 'yyyy-MM-dd'),
          titulo: `Mês Atual - ${format(hoje, 'MMMM yyyy', { locale: ptBR })}`
        };
      case "mes_anterior":
        const mesAnterior = subMonths(hoje, 1);
        return {
          inicio: format(startOfMonth(mesAnterior), 'yyyy-MM-dd'),
          fim: format(endOfMonth(mesAnterior), 'yyyy-MM-dd'),
          titulo: `Mês Anterior - ${format(mesAnterior, 'MMMM yyyy', { locale: ptBR })}`
        };
      case "personalizado":
        return {
          inicio: format(dataInicio!, 'yyyy-MM-dd'),
          fim: format(dataFim!, 'yyyy-MM-dd'),
          titulo: `Período: ${format(dataInicio!, 'dd/MM/yyyy')} a ${format(dataFim!, 'dd/MM/yyyy')}`
        };
      default:
        throw new Error("Período inválido");
    }
  };

  const exportarPDF = async (data: FormData) => {
    try {
      setIsExporting(true);
      
      const { inicio, fim, titulo } = getDatesFromPeriod(data.periodo, data.dataInicio, data.dataFim);
      const registros = await buscarRegistrosPorPeriodo(inicio, fim);

      if (registros.length === 0) {
        toast.error("Nenhum registro encontrado para o período selecionado");
        return;
      }

      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(16);
      doc.text('Controle de Temperatura - Sala de Medicamentos', 14, 15);
      
      // Subtítulo com período
      doc.setFontSize(12);
      doc.text(titulo, 14, 25);
      
      // Informações da norma
      doc.setFontSize(10);
      doc.text('Conforme ANVISA RDC 430/2020 e RDC 301/2019', 14, 32);
      doc.text('Faixa de conformidade: 15°C a 30°C', 14, 38);
      
      // Preparar dados para a tabela
      const tableData = registros.map(registro => [
        format(new Date(registro.data_registro), 'dd/MM/yyyy'),
        registro.horario_medicao,
        registro.periodo_dia === 'manha' ? 'Manhã' : 
        registro.periodo_dia === 'tarde' ? 'Tarde' :
        registro.periodo_dia === 'noite' ? 'Noite' : 'Madrugada',
        `${registro.temperatura}°C`,
        registro.conformidade ? 'Sim' : 'Não',
        registro.nome_responsavel,
        registro.acoes_corretivas || registro.observacoes || '-'
      ]);

      // Configurar tabela
      autoTable(doc, {
        head: [['Data', 'Horário', 'Período', 'Temperatura', 'Conformidade', 'Responsável', 'Observações']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          3: { halign: 'center' }, // Temperatura
          4: { halign: 'center' }, // Conformidade
        },
        didParseCell: function(data) {
          // Colorir células de conformidade
          if (data.column.index === 4 && data.section === 'body') {
            const conformidade = data.cell.text[0] === 'Sim';
            data.cell.styles.fillColor = conformidade ? [220, 255, 220] : [255, 220, 220];
            data.cell.styles.textColor = conformidade ? [0, 100, 0] : [150, 0, 0];
          }
        }
      });

      // Estatísticas
      const totalRegistros = registros.length;
      const registrosConformes = registros.filter(r => r.conformidade).length;
      const percentualConformidade = Math.round((registrosConformes / totalRegistros) * 100);
      
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.text('Resumo:', 14, finalY);
      doc.text(`Total de registros: ${totalRegistros}`, 14, finalY + 7);
      doc.text(`Registros conformes: ${registrosConformes} (${percentualConformidade}%)`, 14, finalY + 14);
      doc.text(`Registros não conformes: ${totalRegistros - registrosConformes}`, 14, finalY + 21);

      // Rodapé
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.text(`Relatório gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, pageHeight - 10);

      // Salvar arquivo
      doc.save(`controle-temperatura-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("Relatório PDF exportado com sucesso!");
      
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const exportarExcel = async (data: FormData) => {
    try {
      setIsExporting(true);
      
      const { inicio, fim, titulo } = getDatesFromPeriod(data.periodo, data.dataInicio, data.dataFim);
      const registros = await buscarRegistrosPorPeriodo(inicio, fim);

      if (registros.length === 0) {
        toast.error("Nenhum registro encontrado para o período selecionado");
        return;
      }

      // Preparar dados para o Excel
      const excelData = registros.map(registro => ({
        'Data': format(new Date(registro.data_registro), 'dd/MM/yyyy'),
        'Horário': registro.horario_medicao,
        'Período': registro.periodo_dia === 'manha' ? 'Manhã' : 
                  registro.periodo_dia === 'tarde' ? 'Tarde' :
                  registro.periodo_dia === 'noite' ? 'Noite' : 'Madrugada',
        'Temperatura (°C)': registro.temperatura,
        'Conformidade': registro.conformidade ? 'Sim' : 'Não',
        'Responsável': registro.nome_responsavel,
        'Local': registro.localizacao_sala,
        'Ações Corretivas': registro.acoes_corretivas || '',
        'Observações': registro.observacoes || '',
        'Data/Hora Registro': format(new Date(registro.created_at), 'dd/MM/yyyy HH:mm')
      }));

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      
      // Adicionar folha
      XLSX.utils.book_append_sheet(wb, ws, "Controle Temperatura");

      // Configurar largura das colunas
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 10 }, // Horário
        { wch: 12 }, // Período
        { wch: 15 }, // Temperatura
        { wch: 12 }, // Conformidade
        { wch: 25 }, // Responsável
        { wch: 20 }, // Local
        { wch: 30 }, // Ações Corretivas
        { wch: 30 }, // Observações
        { wch: 18 }  // Data/Hora Registro
      ];
      ws['!cols'] = colWidths;

      // Salvar arquivo
      XLSX.writeFile(wb, `controle-temperatura-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success("Relatório Excel exportado com sucesso!");
      
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar relatório Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const periodo = form.watch("periodo");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Relatório de Temperatura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="periodo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mes_atual">Mês Atual</SelectItem>
                      <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                      <SelectItem value="personalizado">Período Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {periodo === "personalizado" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Início</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fim</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={form.handleSubmit(exportarPDF)}
                disabled={isExporting}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : "Exportar PDF"}
              </Button>

              <Button
                onClick={form.handleSubmit(exportarExcel)}
                disabled={isExporting}
                variant="outline"
                className="flex-1"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {isExporting ? "Exportando..." : "Exportar Excel"}
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}