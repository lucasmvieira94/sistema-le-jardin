import React, { useState } from "react";
import { FileText, FileSpreadsheet, Loader2, Users, Bot, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FolhaPontoData, TotaisFolhaPonto } from "@/hooks/useFolhaPonto";
import { exportMultipleFuncionariosToPDF, exportMultipleFuncionariosToExcel } from "@/utils/folhaPontoExport";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Funcionario {
  id: string;
  nome_completo: string;
}

interface AlertaIA {
  tipo: string;
  severidade: "alta" | "media" | "baixa";
  funcionario: string;
  descricao: string;
  dias_afetados?: number[];
  sugestao: string;
}

interface AnaliseIA {
  analise_geral: string;
  alertas: AlertaIA[];
  recomendacoes: string[];
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
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [analiseIA, setAnaliseIA] = useState<AnaliseIA | null>(null);
  const [dadosCarregados, setDadosCarregados] = useState<{
    funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }>;
    resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }>;
  } | null>(null);

  const buscarDadosTodosFuncionarios = async () => {
    setLoading(true);
    const funcionariosDados: Array<{ dados: FolhaPontoData[], totais: TotaisFolhaPonto }> = [];
    const resumoGeral: Array<{ nome: string, cpf: string, horas_trabalhadas: string, horas_extras: string, horas_noturnas: string, faltas: number }> = [];

    try {
      for (const funcionario of funcionarios) {
        const { data: folhaData } = await supabase.rpc('gerar_folha_ponto_mensal', {
          p_funcionario_id: funcionario.id,
          p_mes: mes,
          p_ano: ano
        });

        const { data: totaisData } = await supabase.rpc('calcular_totais_folha_ponto', {
          p_funcionario_id: funcionario.id,
          p_mes: mes,
          p_ano: ano
        });

        if (folhaData && folhaData.length > 0 && totaisData && totaisData[0]) {
          const totais = totaisData[0];
          
          const totaisFormatados: TotaisFolhaPonto = {
            total_horas_trabalhadas: String(totais.total_horas_trabalhadas || '00:00:00'),
            total_horas_extras_diurnas: String(totais.total_horas_extras_diurnas || '00:00:00'),
            total_horas_extras_noturnas: String(totais.total_horas_extras_noturnas || '00:00:00'),
            total_faltas: Number(totais.total_faltas || 0),
            total_abonos: Number(totais.total_abonos || 0),
            dias_trabalhados: Number(totais.dias_trabalhados || 0)
          };
          
          funcionariosDados.push({ dados: folhaData, totais: totaisFormatados });

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

      const resultado = { funcionariosDados, resumoGeral };
      setDadosCarregados(resultado);
      return resultado;
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const analisarComIA = async () => {
    setAnalisandoIA(true);
    setAnaliseIA(null);
    
    try {
      let dados = dadosCarregados;
      if (!dados) {
        dados = await buscarDadosTodosFuncionarios();
      }

      if (!dados.funcionariosDados.length) {
        toast({
          variant: "destructive",
          title: "Nenhum registro encontrado",
          description: "Não há dados para analisar neste período"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('analisar-folha-ponto', {
        body: {
          dadosFuncionarios: dados.funcionariosDados,
          mes,
          ano
        }
      });

      if (error) {
        throw error;
      }

      setAnaliseIA(data as AnaliseIA);
      
      toast({
        title: "Análise concluída",
        description: `${(data as AnaliseIA).alertas?.length || 0} alerta(s) identificado(s)`
      });
    } catch (error: any) {
      console.error('Erro na análise IA:', error);
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar os dados"
      });
    } finally {
      setAnalisandoIA(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const dadosCompletos = dadosCarregados || await buscarDadosTodosFuncionarios();
      
      if (!dadosCompletos.funcionariosDados.length) {
        toast({ variant: "destructive", title: "Nenhum registro encontrado", description: `Nenhum funcionário possui registros de ponto em ${meses.find(m => m.value === mes)?.label}/${ano}` });
        return;
      }

      await exportMultipleFuncionariosToPDF(dadosCompletos.funcionariosDados, dadosCompletos.resumoGeral, mes, ano);
      toast({ title: "PDF gerado com sucesso!", description: `Relatório com ${dadosCompletos.funcionariosDados.length} funcionários exportado` });
    } catch (error) {
      console.error('Erro na exportação PDF:', error);
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: "Verifique se há dados disponíveis para o período selecionado" });
    }
    setExporting(null);
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const dadosCompletos = dadosCarregados || await buscarDadosTodosFuncionarios();
      
      if (!dadosCompletos.funcionariosDados.length) {
        toast({ variant: "destructive", title: "Nenhum registro encontrado", description: `Nenhum funcionário possui registros de ponto em ${meses.find(m => m.value === mes)?.label}/${ano}` });
        return;
      }

      await exportMultipleFuncionariosToExcel(dadosCompletos.funcionariosDados, dadosCompletos.resumoGeral, mes, ano);
      toast({ title: "Excel gerado com sucesso!", description: `Planilha com ${dadosCompletos.funcionariosDados.length} funcionários exportada` });
    } catch (error) {
      console.error('Erro na exportação Excel:', error);
      toast({ variant: "destructive", title: "Erro ao gerar Excel", description: "Verifique se há dados disponíveis para o período selecionado" });
    }
    setExporting(null);
  };

  const getSeveridadeIcon = (severidade: string) => {
    switch (severidade) {
      case 'alta': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'media': return <Info className="w-4 h-4 text-yellow-500" />;
      default: return <CheckCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSeveridadeBadge = (severidade: string) => {
    switch (severidade) {
      case 'alta': return <Badge variant="destructive">Alta</Badge>;
      case 'media': return <Badge className="bg-yellow-500 text-white">Média</Badge>;
      default: return <Badge variant="secondary">Baixa</Badge>;
    }
  };

  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Reset analysis when month/year changes
  const handleMesChange = (value: string) => {
    setMes(parseInt(value));
    setAnaliseIA(null);
    setDadosCarregados(null);
  };
  
  const handleAnoChange = (value: string) => {
    setAno(parseInt(value));
    setAnaliseIA(null);
    setDadosCarregados(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${analiseIA ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle>Exportar Folhas de Ponto - Todos os Funcionários</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-sm">
              Exportar folhas de ponto de todos os {funcionarios.length} funcionários ativos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mes">Mês</Label>
              <Select value={mes.toString()} onValueChange={handleMesChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ano">Ano</Label>
              <Select value={ano.toString()} onValueChange={handleAnoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
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

          {/* Botão de análise IA */}
          <Button
            onClick={analisarComIA}
            disabled={loading || analisandoIA}
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/5"
          >
            {analisandoIA ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-2" />
            )}
            {analisandoIA ? 'Analisando com IA...' : 'Analisar dados com IA antes de exportar'}
          </Button>

          {/* Resultados da análise IA */}
          {analiseIA && (
            <ScrollArea className="flex-1 max-h-[300px] border rounded-lg p-3 bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    Resultado da Análise
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setAnaliseIA(null)} className="h-6 w-6 p-0">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">{analiseIA.analise_geral}</p>

                {analiseIA.alertas && analiseIA.alertas.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground">Alertas ({analiseIA.alertas.length})</h5>
                    {analiseIA.alertas.map((alerta, idx) => (
                      <div key={idx} className="bg-background rounded-md p-2 border space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeveridadeIcon(alerta.severidade)}
                          <span className="text-xs font-medium flex-1">{alerta.funcionario}</span>
                          {getSeveridadeBadge(alerta.severidade)}
                        </div>
                        <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                        {alerta.dias_afetados && alerta.dias_afetados.length > 0 && (
                          <p className="text-xs"><strong>Dias:</strong> {alerta.dias_afetados.join(', ')}</p>
                        )}
                        <p className="text-xs text-primary"><strong>Sugestão:</strong> {alerta.sugestao}</p>
                      </div>
                    ))}
                  </div>
                )}

                {analiseIA.recomendacoes && analiseIA.recomendacoes.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground">Recomendações</h5>
                    {analiseIA.recomendacoes.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
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
