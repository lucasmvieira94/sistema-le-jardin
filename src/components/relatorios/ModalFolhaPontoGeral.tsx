import React, { useState } from "react";
import { FileText, FileSpreadsheet, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFolhaPonto, FolhaPontoData, TotaisFolhaPonto } from "@/hooks/useFolhaPonto";
import { exportToPDF, exportToExcel, exportMultipleFuncionariosToPDF, exportMultipleFuncionariosToExcel } from "@/utils/folhaPontoExport";

interface Funcionario {
  id: string;
  nome_completo: string;
}

interface ModalFolhaPontoGeralProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarios: Funcionario[];
}

export default function ModalFolhaPontoGeral({ open, onOpenChange, funcionarios }: ModalFolhaPontoGeralProps) {
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [loading, setLoading] = useState(false);

  const buscarDadosTodosFuncionarios = async () => {
    setLoading(true);
    const funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }> = [];
    const resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }> = [];

    try {
      for (const funcionario of funcionarios) {
        const { data: folhaData } = await supabase.rpc(
          'gerar_folha_ponto_mensal',
          {
            p_funcionario_id: funcionario.id,
            p_mes: mes,
            p_ano: ano
          }
        );

        const { data: totaisData } = await supabase.rpc(
          'calcular_totais_folha_ponto',
          {
            p_funcionario_id: funcionario.id,
            p_mes: mes,
            p_ano: ano
          }
        );

        if (folhaData && folhaData.length > 0 && totaisData && totaisData[0]) {
          const totais = totaisData[0];
          
          // Garantir que os tipos estão corretos
          const totaisFormatados: TotaisFolhaPonto = {
            total_horas_trabalhadas: String(totais.total_horas_trabalhadas || '00:00:00'),
            total_horas_extras_diurnas: String(totais.total_horas_extras_diurnas || '00:00:00'),
            total_horas_extras_noturnas: String(totais.total_horas_extras_noturnas || '00:00:00'),
            total_faltas: Number(totais.total_faltas || 0),
            total_abonos: Number(totais.total_abonos || 0),
            dias_trabalhados: Number(totais.dias_trabalhados || 0)
          };
          
          funcionariosDados.push({
            dados: folhaData,
            totais: totaisFormatados
          });

          // Adicionar ao resumo geral
          const funcionarioInfo = folhaData[0];
          resumoGeral.push({
            nome: funcionarioInfo.funcionario_nome,
            cpf: funcionarioInfo.funcionario_cpf,
            horas_trabalhadas: String(totais.total_horas_trabalhadas || '00:00:00'),
            horas_extras: String(totais.total_horas_extras_diurnas || '00:00:00'),
            horas_noturnas: String(totais.total_horas_extras_noturnas || '00:00:00'),
            faltas: Number(totais.total_faltas || 0)
          });
        }
      }

      return { funcionariosDados, resumoGeral };
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const dadosCompletos = await buscarDadosTodosFuncionarios();
      
      if (!dadosCompletos.funcionariosDados.length) {
        toast({
          variant: "destructive",
          title: "Nenhum registro encontrado",
          description: `Nenhum funcionário possui registros de ponto em ${meses.find(m => m.value === mes)?.label}/${ano}`
        });
        return;
      }

      await exportMultipleFuncionariosToPDF(dadosCompletos.funcionariosDados, dadosCompletos.resumoGeral, mes, ano);
      toast({
        title: "PDF gerado com sucesso!",
        description: `Relatório com ${dadosCompletos.funcionariosDados.length} funcionários exportado`
      });
    } catch (error) {
      console.error('Erro na exportação PDF:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: "Verifique se há dados disponíveis para o período selecionado"
      });
    }
    setExporting(null);
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const dadosCompletos = await buscarDadosTodosFuncionarios();
      
      if (!dadosCompletos.funcionariosDados.length) {
        toast({
          variant: "destructive",
          title: "Nenhum registro encontrado",
          description: `Nenhum funcionário possui registros de ponto em ${meses.find(m => m.value === mes)?.label}/${ano}`
        });
        return;
      }

      await exportMultipleFuncionariosToExcel(dadosCompletos.funcionariosDados, dadosCompletos.resumoGeral, mes, ano);
      toast({
        title: "Excel gerado com sucesso!",
        description: `Planilha com ${dadosCompletos.funcionariosDados.length} funcionários exportada`
      });
    } catch (error) {
      console.error('Erro na exportação Excel:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar Excel",
        description: "Verifique se há dados disponíveis para o período selecionado"
      });
    }
    setExporting(null);
  };

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Folhas de Ponto - Todos os Funcionários</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-sm">
              Exportar folhas de ponto de todos os {funcionarios.length} funcionários ativos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mes">Mês</Label>
              <Select value={mes.toString()} onValueChange={(value) => setMes(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ano">Ano</Label>
              <Select value={ano.toString()} onValueChange={(value) => setAno(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando dados de todos os funcionários...
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleExportPDF}
              disabled={loading || exporting === 'pdf'}
              className="flex-1"
            >
              {exporting === 'pdf' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Exportar PDF
            </Button>
            
            <Button 
              onClick={handleExportExcel}
              disabled={loading || exporting === 'excel'}
              variant="outline"
              className="flex-1"
            >
              {exporting === 'excel' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Exportar Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}