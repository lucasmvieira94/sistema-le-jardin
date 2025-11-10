import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CalendarIcon, FileText, Loader2, TrendingUp, AlertTriangle, Info, CheckCircle, Eye, Download, Mail } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRelatoriosIA } from '@/hooks/useRelatoriosIA';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ConfiguracaoAgendamento } from '@/components/relatorios-ia/ConfiguracaoAgendamento';

export default function RelatoriosIA() {
  const [dataInicio, setDataInicio] = useState<Date>(subDays(new Date(), 7));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<any>(null);
  const [alertaSelecionado, setAlertaSelecionado] = useState<any>(null);
  const [observacoes, setObservacoes] = useState('');
  const [emailGestor, setEmailGestor] = useState('');
  const [nomeGestor, setNomeGestor] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [relatorioParaEnviar, setRelatorioParaEnviar] = useState<any>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const { 
    relatorios, 
    isLoadingRelatorios, 
    alertas, 
    isLoadingAlertas,
    gerarRelatorio,
    atualizarStatusAlerta 
  } = useRelatoriosIA();

  const handleGerarRelatorio = () => {
    gerarRelatorio.mutate({
      dataInicio: format(dataInicio, 'yyyy-MM-dd'),
      dataFim: format(dataFim, 'yyyy-MM-dd'),
    });
  };

  const handleVisualizarAlerta = (alerta: any) => {
    setAlertaSelecionado(alerta);
    if (alerta.status === 'pendente') {
      atualizarStatusAlerta.mutate({ 
        alertaId: alerta.id, 
        status: 'visualizado' 
      });
    }
  };

  const handleResolverAlerta = () => {
    if (alertaSelecionado) {
      atualizarStatusAlerta.mutate({
        alertaId: alertaSelecionado.id,
        status: 'resolvido',
        observacoes,
      });
      setAlertaSelecionado(null);
      setObservacoes('');
    }
  };

  const generatePDFDoc = (relatorio: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatorio Semanal - Analise com IA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Período
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const periodo = `Periodo: ${format(new Date(relatorio.data_inicio), 'dd/MM/yyyy')} ate ${format(new Date(relatorio.data_fim), 'dd/MM/yyyy')}`;
    doc.text(periodo, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Resumo Executivo
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Executivo', 14, yPos);
    yPos += 7;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const resumoLines = doc.splitTextToSize(relatorio.relatorio.resumo_executivo, pageWidth - 28);
    doc.text(resumoLines, 14, yPos);
    yPos += resumoLines.length * 5 + 10;

    // Métricas Gerais
    if (relatorio.relatorio.metricas_gerais) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Metricas Gerais', 14, yPos);
      yPos += 7;

      const metricas = Object.entries(relatorio.relatorio.metricas_gerais).map(([key, value]) => [
        key.replace(/_/g, ' ').toUpperCase(),
        String(value)
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Metrica', 'Valor']],
        body: metricas,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Nova página se necessário
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Análise Detalhada
    if (relatorio.relatorio.analise_detalhada) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Analise Detalhada', 14, yPos);
      yPos += 7;

      const analise = relatorio.relatorio.analise_detalhada;

      // Pontos Positivos
      if (analise.pontos_positivos?.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94);
        doc.setFont('helvetica', 'bold');
        doc.text('Pontos Positivos:', 14, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        analise.pontos_positivos.forEach((ponto: string) => {
          const lines = doc.splitTextToSize(`• ${ponto}`, pageWidth - 28);
          doc.text(lines, 14, yPos);
          yPos += lines.length * 5 + 2;
        });
        yPos += 5;
      }

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Áreas de Atenção
      if (analise.areas_atencao?.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(234, 179, 8);
        doc.setFont('helvetica', 'bold');
        doc.text('Areas de Atencao:', 14, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        analise.areas_atencao.forEach((area: string) => {
          const lines = doc.splitTextToSize(`• ${area}`, pageWidth - 28);
          doc.text(lines, 14, yPos);
          yPos += lines.length * 5 + 2;
        });
        yPos += 5;
      }

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Tendências
      if (analise.tendencias?.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(59, 130, 246);
        doc.setFont('helvetica', 'bold');
        doc.text('Tendencias Observadas:', 14, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        analise.tendencias.forEach((tendencia: string) => {
          const lines = doc.splitTextToSize(`• ${tendencia}`, pageWidth - 28);
          doc.text(lines, 14, yPos);
          yPos += lines.length * 5 + 2;
        });
        yPos += 5;
      }

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Observações em Destaque
      if (analise.observacoes_destaque?.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(168, 85, 247);
        doc.setFont('helvetica', 'bold');
        doc.text('Observacoes em Destaque:', 14, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        analise.observacoes_destaque.forEach((obs: string) => {
          const lines = doc.splitTextToSize(`• ${obs}`, pageWidth - 28);
          doc.text(lines, 14, yPos);
          yPos += lines.length * 5 + 2;
        });
        yPos += 5;
      }
    }

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Soluções e Melhorias
    if (relatorio.relatorio.solucoes_melhorias?.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Solucoes e Melhorias Propostas', 14, yPos);
      yPos += 7;

      relatorio.relatorio.solucoes_melhorias.forEach((solucao: any, index: number) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. Area: ${solucao.area}`, 14, yPos);
        yPos += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        doc.text('Problema:', 14, yPos);
        yPos += 5;
        const problemaLines = doc.splitTextToSize(solucao.problema_identificado, pageWidth - 28);
        doc.text(problemaLines, 14, yPos);
        yPos += problemaLines.length * 5 + 3;

        doc.text('Solucao:', 14, yPos);
        yPos += 5;
        const solucaoLines = doc.splitTextToSize(solucao.solucao_proposta, pageWidth - 28);
        doc.text(solucaoLines, 14, yPos);
        yPos += solucaoLines.length * 5 + 3;

        doc.text('Beneficio:', 14, yPos);
        yPos += 5;
        const beneficioLines = doc.splitTextToSize(solucao.beneficio_esperado, pageWidth - 28);
        doc.text(beneficioLines, 14, yPos);
        yPos += beneficioLines.length * 5 + 8;
      });
    }

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Recomendações
    if (relatorio.relatorio.recomendacoes?.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Recomendacoes', 14, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      relatorio.relatorio.recomendacoes.forEach((rec: string, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, pageWidth - 28);
        doc.text(lines, 14, yPos);
        yPos += lines.length * 5 + 3;
      });
    }

    return doc;
  };

  const handleDownloadPDF = (relatorio: any) => {
    try {
      const doc = generatePDFDoc(relatorio);
      const nomeArquivo = `relatorio_${format(new Date(relatorio.data_inicio), 'dd-MM-yyyy')}_${format(new Date(relatorio.data_fim), 'dd-MM-yyyy')}.pdf`;
      doc.save(nomeArquivo);
      toast.success('Relatório baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleEnviarEmail = async () => {
    if (!emailGestor || !nomeGestor || !relatorioParaEnviar) {
      toast.error('Preencha todos os campos');
      return;
    }

    setEnviandoEmail(true);
    try {
      const doc = generatePDFDoc(relatorioParaEnviar);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('enviar-relatorio-email', {
        body: {
          emailGestor,
          nomeGestor,
          relatorio: relatorioParaEnviar,
          pdfBase64,
        },
      });

      if (error) throw error;

      toast.success('Relatório enviado por email com sucesso!');
      setShowEmailDialog(false);
      setEmailGestor('');
      setNomeGestor('');
      setRelatorioParaEnviar(null);
    } catch (error: any) {
      console.error('Erro ao enviar email:', error);
      toast.error(error.message || 'Erro ao enviar email');
    } finally {
      setEnviandoEmail(false);
    }
  };

  const abrirDialogEmail = (relatorio: any) => {
    setRelatorioParaEnviar(relatorio);
    setShowEmailDialog(true);
  };

  const handleTesteEmail = async () => {
    try {
      toast.info("Gerando relatório de teste...");
      
      // Calcular últimos 7 dias
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 7);

      // Gerar relatório
      const { data: relatorioData, error: relatorioError } = await supabase.functions.invoke('analisar-prontuarios', {
        body: {
          dataInicio: format(dataInicio, 'yyyy-MM-dd'),
          dataFim: format(dataFim, 'yyyy-MM-dd'),
        },
      });

      if (relatorioError) throw relatorioError;

      if (!relatorioData?.relatorio) {
        throw new Error("Erro ao gerar relatório");
      }

      toast.success("Relatório gerado! Enviando email...");

      // Enviar email de teste
      const doc = generatePDFDoc(relatorioData.relatorio);
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      const { error: emailError } = await supabase.functions.invoke('enviar-relatorio-email', {
        body: {
          emailGestor: "lucasmoraesv.dev@gmail.com",
          nomeGestor: "Lucas Moraes (Teste)",
          relatorio: relatorioData.relatorio,
          pdfBase64,
        },
      });

      if (emailError) throw emailError;

      toast.success("Email de teste enviado com sucesso para lucasmoraesv.dev@gmail.com!");
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast.error(error.message || "Erro ao enviar email de teste");
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'atencao':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return 'destructive';
      case 'atencao':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline">Pendente</Badge>;
      case 'visualizado':
        return <Badge variant="secondary">Visualizado</Badge>;
      case 'resolvido':
        return <Badge variant="default" className="bg-green-600">Resolvido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const alertasPorStatus = {
    pendente: alertas.filter(a => a.status === 'pendente'),
    visualizado: alertas.filter(a => a.status === 'visualizado'),
    resolvido: alertas.filter(a => a.status === 'resolvido'),
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios com IA</h1>
          <p className="text-muted-foreground">
            Análise inteligente de prontuários e alertas de não conformidade
          </p>
        </div>
      </div>

      {/* Gerador de Relatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Novo Relatório
          </CardTitle>
          <CardDescription>
            Selecione o período para análise automática dos prontuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(date) => date && setDataInicio(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(date) => date && setDataFim(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handleGerarRelatorio}
              disabled={gerarRelatorio.isPending}
              className="gap-2"
            >
              {gerarRelatorio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Gerar Relatório
                </>
              )}
            </Button>

            <Button 
              onClick={handleTesteEmail}
              variant="outline"
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Teste de Email
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              A IA analisará todos os prontuários, medicamentos e registros do período selecionado,
              identificando padrões e possíveis não conformidades.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Configuração de Agendamento */}
      <ConfiguracaoAgendamento />

      {/* Tabs */}
      <Tabs defaultValue="alertas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alertas">
            Alertas ({alertasPorStatus.pendente.length})
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            Relatórios ({relatorios.length})
          </TabsTrigger>
        </TabsList>

        {/* Alertas */}
        <TabsContent value="alertas" className="space-y-4">
          <div className="grid gap-4">
            {isLoadingAlertas ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
              </Card>
            ) : alertas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum alerta encontrado. Gere um relatório para começar.
                </CardContent>
              </Card>
            ) : (
              <>
                {alertasPorStatus.pendente.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Pendentes</h3>
                    {alertasPorStatus.pendente.map((alerta) => (
                      <Card 
                        key={alerta.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleVisualizarAlerta(alerta)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {getTipoIcon(alerta.tipo_alerta)}
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getTipoBadgeVariant(alerta.tipo_alerta)}>
                                    {alerta.tipo_alerta}
                                  </Badge>
                                  <Badge variant="outline">{alerta.categoria}</Badge>
                                  {getStatusBadge(alerta.status)}
                                </div>
                                <p className="font-medium">{alerta.descricao}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(alerta.data_ocorrencia), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {alertasPorStatus.visualizado.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Visualizados</h3>
                    {alertasPorStatus.visualizado.map((alerta) => (
                      <Card 
                        key={alerta.id}
                        className="cursor-pointer hover:shadow-md transition-shadow opacity-75"
                        onClick={() => handleVisualizarAlerta(alerta)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {getTipoIcon(alerta.tipo_alerta)}
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getTipoBadgeVariant(alerta.tipo_alerta)}>
                                    {alerta.tipo_alerta}
                                  </Badge>
                                  <Badge variant="outline">{alerta.categoria}</Badge>
                                  {getStatusBadge(alerta.status)}
                                </div>
                                <p className="font-medium">{alerta.descricao}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(alerta.data_ocorrencia), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {alertasPorStatus.resolvido.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Resolvidos</h3>
                    {alertasPorStatus.resolvido.slice(0, 5).map((alerta) => (
                      <Card 
                        key={alerta.id}
                        className="cursor-pointer hover:shadow-md transition-shadow opacity-50"
                        onClick={() => handleVisualizarAlerta(alerta)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getTipoBadgeVariant(alerta.tipo_alerta)}>
                                    {alerta.tipo_alerta}
                                  </Badge>
                                  <Badge variant="outline">{alerta.categoria}</Badge>
                                  {getStatusBadge(alerta.status)}
                                </div>
                                <p className="font-medium">{alerta.descricao}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(alerta.data_ocorrencia), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-4">
            {isLoadingRelatorios ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
              </Card>
            ) : relatorios.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum relatório gerado ainda.
                </CardContent>
              </Card>
            ) : (
              relatorios.map((relatorio) => (
                <Card 
                  key={relatorio.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setRelatorioSelecionado(relatorio)}>
                        <CardTitle className="text-lg">
                          Relatório Semanal
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(relatorio.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                          {format(new Date(relatorio.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {relatorio.nao_conformidades_encontradas} alertas
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDialogEmail(relatorio);
                          }}
                          title="Enviar por Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(relatorio);
                          }}
                          title="Baixar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="cursor-pointer" onClick={() => setRelatorioSelecionado(relatorio)}>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {relatorio.resumo_executivo}
                    </p>
                    <div className="mt-4 flex gap-4 text-sm">
                      <span>
                        <strong>{relatorio.total_prontuarios}</strong> prontuários
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Detalhes do Alerta */}
      <Dialog open={!!alertaSelecionado} onOpenChange={() => setAlertaSelecionado(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {alertaSelecionado && getTipoIcon(alertaSelecionado.tipo_alerta)}
              Detalhes do Alerta
            </DialogTitle>
            <DialogDescription>
              {alertaSelecionado && format(new Date(alertaSelecionado.data_ocorrencia), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          
          {alertaSelecionado && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant={getTipoBadgeVariant(alertaSelecionado.tipo_alerta)}>
                  {alertaSelecionado.tipo_alerta}
                </Badge>
                <Badge variant="outline">{alertaSelecionado.categoria}</Badge>
                {getStatusBadge(alertaSelecionado.status)}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Descrição</h4>
                <p className="text-sm">{alertaSelecionado.descricao}</p>
              </div>

              {alertaSelecionado.detalhes && (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Contexto</h4>
                    <p className="text-sm bg-muted p-3 rounded-md">
                      {alertaSelecionado.detalhes.contexto}
                    </p>
                  </div>
                  
                  {alertaSelecionado.detalhes.acao_recomendada && (
                    <div>
                      <h4 className="font-semibold mb-2 text-blue-600">Ação Recomendada</h4>
                      <p className="text-sm bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                        {alertaSelecionado.detalhes.acao_recomendada}
                      </p>
                    </div>
                  )}

                  {alertaSelecionado.detalhes.prazo_acao && (
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        alertaSelecionado.detalhes.prazo_acao === 'urgente' ? 'destructive' :
                        alertaSelecionado.detalhes.prazo_acao === 'curto prazo' ? 'default' : 'secondary'
                      }>
                        Prazo: {alertaSelecionado.detalhes.prazo_acao}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {alertaSelecionado.impacto_potencial && (
                <div>
                  <h4 className="font-semibold mb-2 text-orange-600">Impacto Potencial</h4>
                  <p className="text-sm bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                    {alertaSelecionado.impacto_potencial}
                  </p>
                </div>
              )}

              {alertaSelecionado.status !== 'resolvido' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Observações (opcional)
                  </label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações sobre a resolução..."
                    rows={3}
                  />
                  <Button 
                    onClick={handleResolverAlerta}
                    disabled={atualizarStatusAlerta.isPending}
                    className="w-full"
                  >
                    {atualizarStatusAlerta.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Marcar como Resolvido
                  </Button>
                </div>
              )}

              {alertaSelecionado.observacoes && (
                <div>
                  <h4 className="font-semibold mb-2">Observações da Resolução</h4>
                  <p className="text-sm bg-muted p-3 rounded-md">
                    {alertaSelecionado.observacoes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes do Relatório */}
      <Dialog open={!!relatorioSelecionado} onOpenChange={() => setRelatorioSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Relatório Semanal Completo</DialogTitle>
                <DialogDescription>
                  {relatorioSelecionado && (
                    <>
                      {format(new Date(relatorioSelecionado.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                      {format(new Date(relatorioSelecionado.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                    </>
                  )}
                </DialogDescription>
              </div>
              {relatorioSelecionado && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirDialogEmail(relatorioSelecionado)}
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Enviar por Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPDF(relatorioSelecionado)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar PDF
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {relatorioSelecionado?.relatorio && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Resumo Executivo</h3>
                <p className="text-sm bg-primary/5 p-4 rounded-md">
                  {relatorioSelecionado.relatorio.resumo_executivo}
                </p>
              </div>

              {relatorioSelecionado.relatorio.metricas_gerais && (
                <div>
                  <h3 className="font-semibold mb-3">Métricas Gerais</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(relatorioSelecionado.relatorio.metricas_gerais).map(([key, value]) => (
                      <Card key={key}>
                        <CardContent className="p-4">
                          <p className="text-2xl font-bold">{String(value)}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {relatorioSelecionado.relatorio.analise_detalhada && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Análise Detalhada</h3>
                  
                  {relatorioSelecionado.relatorio.analise_detalhada.pontos_positivos?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-green-600">Pontos Positivos</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {relatorioSelecionado.relatorio.analise_detalhada.pontos_positivos.map((ponto: string, i: number) => (
                          <li key={i}>{ponto}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {relatorioSelecionado.relatorio.analise_detalhada.areas_atencao?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-yellow-600">Áreas de Atenção</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {relatorioSelecionado.relatorio.analise_detalhada.areas_atencao.map((area: string, i: number) => (
                          <li key={i}>{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {relatorioSelecionado.relatorio.analise_detalhada.tendencias?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tendências Observadas</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {relatorioSelecionado.relatorio.analise_detalhada.tendencias.map((tendencia: string, i: number) => (
                          <li key={i}>{tendencia}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {relatorioSelecionado.relatorio.analise_detalhada.observacoes_destaque?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-purple-600">Observações em Destaque</h4>
                      <div className="space-y-2">
                        {relatorioSelecionado.relatorio.analise_detalhada.observacoes_destaque.map((obs: string, i: number) => (
                          <div key={i} className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md border border-purple-200 dark:border-purple-800">
                            <p className="text-sm">{obs}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {relatorioSelecionado.relatorio.solucoes_melhorias?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Soluções e Melhorias Propostas</h3>
                  <div className="space-y-3">
                    {relatorioSelecionado.relatorio.solucoes_melhorias.map((solucao: any, i: number) => (
                      <Card key={i} className="border-green-200 dark:border-green-800">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              {solucao.area}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Problema:</p>
                            <p className="text-sm">{solucao.problema_identificado}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">Solução Proposta:</p>
                            <p className="text-sm">{solucao.solucao_proposta}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-600">Benefício Esperado:</p>
                            <p className="text-sm">{solucao.beneficio_esperado}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {relatorioSelecionado.relatorio.recomendacoes?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Recomendações</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    {relatorioSelecionado.relatorio.recomendacoes.map((rec: string, i: number) => (
                      <li key={i} className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Envio por Email */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar Relatório por Email</DialogTitle>
            <DialogDescription>
              Preencha os dados do gestor para enviar o relatório por email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-gestor">Nome do Gestor</Label>
              <Input
                id="nome-gestor"
                placeholder="Digite o nome do gestor"
                value={nomeGestor}
                onChange={(e) => setNomeGestor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-gestor">Email do Gestor</Label>
              <Input
                id="email-gestor"
                type="email"
                placeholder="gestor@exemplo.com"
                value={emailGestor}
                onChange={(e) => setEmailGestor(e.target.value)}
              />
            </div>
            {relatorioParaEnviar && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Relatório a ser enviado:</p>
                <p className="text-sm text-muted-foreground">
                  Período: {format(new Date(relatorioParaEnviar.data_inicio), 'dd/MM/yyyy')} a{' '}
                  {format(new Date(relatorioParaEnviar.data_fim), 'dd/MM/yyyy')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {relatorioParaEnviar.total_prontuarios} prontuários • {relatorioParaEnviar.nao_conformidades_encontradas} não conformidades
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailDialog(false)} 
              disabled={enviandoEmail}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleEnviarEmail} 
              disabled={enviandoEmail || !emailGestor || !nomeGestor}
            >
              {enviandoEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}