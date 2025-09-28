
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { useFolhaPonto } from "@/hooks/useFolhaPonto";
import { exportToPDF, exportToExcel } from "@/utils/folhaPontoExport";
import { toast } from "@/components/ui/use-toast";

interface Funcionario {
  id: string;
  nome_completo: string;
}

interface ModalFolhaPontoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarios: Funcionario[];
}

export default function ModalFolhaPonto({ open, onOpenChange, funcionarios }: ModalFolhaPontoProps) {
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const { data, isLoading } = useFolhaPonto(
    funcionarioId, 
    mes, 
    ano, 
    !!funcionarioId && mes > 0 && ano > 0
  );
  
  console.log('ModalFolhaPonto - data:', data);
  console.log('ModalFolhaPonto - funcionarioId:', funcionarioId);

  const handleExportPDF = async () => {
    if (!funcionarioId) {
      toast({
        variant: "destructive",
        title: "Selecione um funcionário antes de exportar"
      });
      return;
    }

    if (!data || !data.dados.length) {
      const funcionarioNome = funcionarios.find(f => f.id === funcionarioId)?.nome_completo || 'funcionário selecionado';
      toast({
        variant: "destructive",
        title: "Nenhum registro de ponto encontrado",
        description: `Não há registros de ponto para ${funcionarioNome} em ${meses.find(m => m.value === mes)?.label}/${ano}`
      });
      return;
    }

    setExporting('pdf');
    try {
      await exportToPDF(data.dados, data.totais, mes, ano);
      toast({
        title: "PDF gerado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF"
      });
    }
    setExporting(null);
  };

  const handleExportExcel = async () => {
    if (!funcionarioId) {
      toast({
        variant: "destructive",
        title: "Selecione um funcionário antes de exportar"
      });
      return;
    }

    if (!data || !data.dados.length) {
      const funcionarioNome = funcionarios.find(f => f.id === funcionarioId)?.nome_completo || 'funcionário selecionado';
      toast({
        variant: "destructive",
        title: "Nenhum registro de ponto encontrado",
        description: `Não há registros de ponto para ${funcionarioNome} em ${meses.find(m => m.value === mes)?.label}/${ano}`
      });
      return;
    }

    setExporting('excel');
    try {
      await exportToExcel(data.dados, data.totais, mes, ano);
      toast({
        title: "Excel gerado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar Excel"
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
          <DialogTitle>Exportar Folha de Ponto Mensal</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="funcionario">Funcionário</Label>
            <Select value={funcionarioId} onValueChange={setFuncionarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map((func) => (
                  <SelectItem key={func.id} value={func.id}>
                    {func.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {isLoading && funcionarioId && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando dados...
            </div>
          )}

          {data && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                {data.dados.length > 0 ? data.dados[0].funcionario_nome : 'Funcionário'}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.totais.dias_trabalhados} dias trabalhados • {data.totais.total_faltas} faltas
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleExportPDF}
              disabled={!data || !data.dados.length || exporting === 'pdf'}
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
              disabled={!data || !data.dados.length || exporting === 'excel'}
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
