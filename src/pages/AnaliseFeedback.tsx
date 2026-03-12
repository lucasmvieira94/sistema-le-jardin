import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessageSquareHeart,
  Users,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Sparkles,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Simple markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-4 text-primary">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-3">{line.slice(4)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold mt-2">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm list-disc">{formatBold(line.slice(2))}</li>;
        if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 text-sm list-decimal">{formatBold(line.replace(/^\d+\.\s/, ""))}</li>;
        if (line.startsWith("| ")) return <p key={i} className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">{line}</p>;
        if (line.startsWith("---")) return <hr key={i} className="my-3" />;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-sm">{formatBold(line)}</p>;
      })}
    </div>
  );
}

function formatBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
}

// -- Label maps for display --
const facilidadeLabels: Record<string, string> = {
  concordo_totalmente: "Concordo totalmente",
  concordo: "Concordo",
  neutro: "Neutro",
  discordo: "Discordo",
  discordo_totalmente: "Discordo totalmente",
};

const dificuldadeLabels: Record<string, string> = {
  nenhuma: "Nenhuma",
  pouca: "Pouca",
  moderada: "Moderada",
  muita: "Muita",
};

const satisfacaoLabels: Record<string, string> = {
  muito_satisfeito: "Muito satisfeito",
  satisfeito: "Satisfeito",
  neutro: "Neutro",
  insatisfeito: "Insatisfeito",
  nao_utilizo: "Não utilizo",
};

const COLORS = ["#166534", "#22c55e", "#86efac", "#fbbf24", "#ef4444", "#94a3b8"];

type FeedbackRow = {
  id: string;
  created_at: string;
  funcionario_nome: string;
  facilidade_uso: string;
  dificuldade_ferramentas_digitais: string;
  satisfacao_registro_ponto: string | null;
  satisfacao_prontuario: string | null;
  satisfacao_controle_temperatura: string | null;
  satisfacao_controle_fraldas: string | null;
  satisfacao_escala: string | null;
  processos_manuais: string | null;
  funcionalidades_desejadas: string | null;
  melhorias_sugeridas: string | null;
  sugestoes: string | null;
  criticas: string | null;
  elogios: string | null;
  observacoes_gerais: string | null;
};

function countField(data: FeedbackRow[], field: keyof FeedbackRow, labelMap: Record<string, string>) {
  const counts: Record<string, number> = {};
  for (const key of Object.keys(labelMap)) counts[key] = 0;
  data.forEach((row) => {
    const val = row[field] as string | null;
    if (val && counts[val] !== undefined) counts[val]++;
  });
  return Object.entries(counts).map(([key, value]) => ({
    name: labelMap[key] || key,
    value,
  }));
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TextResponsesList({ data, field, title }: { data: FeedbackRow[]; field: keyof FeedbackRow; title: string }) {
  const responses = data
    .map((r) => ({ nome: r.funcionario_nome, texto: r[field] as string | null, data: r.created_at }))
    .filter((r) => r.texto && r.texto.trim().length > 0);

  if (responses.length === 0)
    return <p className="text-sm text-muted-foreground italic">Nenhuma resposta registrada.</p>;

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-3">
        {responses.map((r, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{r.nome}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.data).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{r.texto}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function AnaliseFeedback() {
  const [data, setData] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [relatorioIA, setRelatorioIA] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const relatorioRef = useRef<HTMLDivElement>(null);

  const exportarDashboardPDF = async () => {
    if (!dashboardRef.current) return;
    setExportandoPDF(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Title
      pdf.setFontSize(16);
      pdf.text("Análise de Feedback - Dashboard", 10, 15);
      pdf.setFontSize(9);
      pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, 22);

      let yOffset = 28;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const availableHeight = yOffset === 28 ? pageHeight - 28 - 10 : pageHeight - 20;
        const sliceHeight = Math.min(remainingHeight, availableHeight);
        const sliceCanvasHeight = (sliceHeight / imgHeight) * canvas.height;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceCanvasHeight;
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceCanvasHeight, 0, 0, canvas.width, sliceCanvasHeight);
          const sliceData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", 10, yOffset, imgWidth, sliceHeight);
        }

        remainingHeight -= sliceHeight;
        sourceY += sliceCanvasHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          yOffset = 10;
        }
      }

      // If AI report exists, add it
      if (relatorioIA) {
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text("Relatório Consolidado por IA", 10, 15);
        pdf.setFontSize(9);
        pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, 22);
        
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(relatorioIA.replace(/[#*]/g, "").replace(/\n{3,}/g, "\n\n"), pageWidth - 20);
        let y = 30;
        for (const line of lines) {
          if (y > pageHeight - 15) {
            pdf.addPage();
            y = 15;
          }
          pdf.text(line, 10, y);
          y += 5;
        }
      }

      pdf.save(`analise-feedback-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (e: any) {
      console.error("Erro ao exportar PDF:", e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExportandoPDF(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from("feedback_sistema" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && rows) setData(rows as unknown as FeedbackRow[]);
      setLoading(false);
    })();
  }, []);

  const gerarRelatorioIA = async () => {
    setGerandoRelatorio(true);
    setDialogOpen(true);
    setRelatorioIA(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("analisar-feedback");
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setRelatorioIA(result.relatorio);
      toast.success("Relatório gerado com sucesso!");
    } catch (e: any) {
      console.error("Erro ao gerar relatório:", e);
      toast.error(e.message || "Erro ao gerar relatório de IA");
      setDialogOpen(false);
    } finally {
      setGerandoRelatorio(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const total = data.length;

  // Positive ratio
  const positivos = data.filter((r) =>
    ["concordo", "concordo_totalmente"].includes(r.facilidade_uso)
  ).length;
  const taxaPositiva = total > 0 ? Math.round((positivos / total) * 100) : 0;

  // Difficulty ratio
  const comDificuldade = data.filter((r) =>
    ["moderada", "muita"].includes(r.dificuldade_ferramentas_digitais)
  ).length;

  // Criticism count
  const totalCriticas = data.filter((r) => r.criticas && r.criticas.trim().length > 0).length;

  const facilidadeData = countField(data, "facilidade_uso", facilidadeLabels);
  const dificuldadeData = countField(data, "dificuldade_ferramentas_digitais", dificuldadeLabels);

  const modulosSatisfacao = [
    { field: "satisfacao_registro_ponto" as keyof FeedbackRow, label: "Registro de Ponto" },
    { field: "satisfacao_prontuario" as keyof FeedbackRow, label: "Prontuário" },
    { field: "satisfacao_controle_temperatura" as keyof FeedbackRow, label: "Temperatura" },
    { field: "satisfacao_controle_fraldas" as keyof FeedbackRow, label: "Fraldas" },
    { field: "satisfacao_escala" as keyof FeedbackRow, label: "Escala" },
  ];

  // Satisfaction summary per module for bar chart
  const satisfacaoResumo = modulosSatisfacao.map((m) => {
    const satisfeitos = data.filter((r) => {
      const v = r[m.field] as string | null;
      return v === "muito_satisfeito" || v === "satisfeito";
    }).length;
    const responderam = data.filter((r) => {
      const v = r[m.field] as string | null;
      return v && v !== "nao_utilizo";
    }).length;
    return {
      modulo: m.label,
      "% Satisfação": responderam > 0 ? Math.round((satisfeitos / responderam) * 100) : 0,
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <MessageSquareHeart className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Análise de Feedback</h1>
            <p className="text-sm text-muted-foreground">
              Dashboard estatístico das respostas coletadas
            </p>
          </div>
        </div>
        <Button
          onClick={gerarRelatorioIA}
          disabled={gerandoRelatorio || data.length === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
        >
          {gerandoRelatorio ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Gerar Relatório com IA
        </Button>
      </div>

      {/* AI Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Relatório Consolidado por IA
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {gerandoRelatorio ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando {data.length} respostas com IA...</p>
                <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            ) : relatorioIA ? (
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                <MarkdownRenderer content={relatorioIA} />
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total de Respostas" value={total} color="bg-primary" />
        <StatCard icon={ThumbsUp} label="Acham fácil de usar" value={`${taxaPositiva}%`} color="bg-green-600" />
        <StatCard icon={AlertTriangle} label="Com dificuldade digital" value={comDificuldade} color="bg-amber-500" />
        <StatCard icon={ThumbsDown} label="Críticas recebidas" value={totalCriticas} color="bg-red-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facilidade de uso - Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facilidade de Uso do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={facilidadeData.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {facilidadeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Dificuldade digital - Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dificuldade com Ferramentas Digitais</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dificuldadeData.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {dificuldadeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Satisfação por módulo - Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Satisfação por Módulo (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={satisfacaoResumo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="modulo" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="% Satisfação" fill="#166534" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed breakdown per module */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                {Object.values(satisfacaoLabels).map((l) => (
                  <TableHead key={l} className="text-center text-xs">{l}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modulosSatisfacao.map((m) => {
                const breakdown = countField(data, m.field, satisfacaoLabels);
                return (
                  <TableRow key={m.field}>
                    <TableCell className="font-medium text-sm">{m.label}</TableCell>
                    {breakdown.map((b) => (
                      <TableCell key={b.name} className="text-center">
                        <Badge variant={b.value > 0 ? "default" : "secondary"} className="text-xs">
                          {b.value}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Text responses tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respostas Abertas</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sugestoes">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="sugestoes">💡 Sugestões</TabsTrigger>
              <TabsTrigger value="criticas">⚠️ Críticas</TabsTrigger>
              <TabsTrigger value="elogios">⭐ Elogios</TabsTrigger>
              <TabsTrigger value="melhorias">🔧 Melhorias</TabsTrigger>
              <TabsTrigger value="processos">📋 Processos Manuais</TabsTrigger>
              <TabsTrigger value="funcionalidades">🚀 Funcionalidades</TabsTrigger>
            </TabsList>
            <TabsContent value="sugestoes" className="mt-4">
              <TextResponsesList data={data} field="sugestoes" title="Sugestões" />
            </TabsContent>
            <TabsContent value="criticas" className="mt-4">
              <TextResponsesList data={data} field="criticas" title="Críticas" />
            </TabsContent>
            <TabsContent value="elogios" className="mt-4">
              <TextResponsesList data={data} field="elogios" title="Elogios" />
            </TabsContent>
            <TabsContent value="melhorias" className="mt-4">
              <TextResponsesList data={data} field="melhorias_sugeridas" title="Melhorias" />
            </TabsContent>
            <TabsContent value="processos" className="mt-4">
              <TextResponsesList data={data} field="processos_manuais" title="Processos Manuais" />
            </TabsContent>
            <TabsContent value="funcionalidades" className="mt-4">
              <TextResponsesList data={data} field="funcionalidades_desejadas" title="Funcionalidades" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent responses table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respostas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Facilidade</TableHead>
                <TableHead>Dificuldade Digital</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 20).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">
                    {new Date(row.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{row.funcionario_nome}</TableCell>
                  <TableCell>
                    <Badge variant={
                      ["concordo", "concordo_totalmente"].includes(row.facilidade_uso)
                        ? "default"
                        : row.facilidade_uso === "neutro"
                        ? "secondary"
                        : "destructive"
                    } className="text-xs">
                      {facilidadeLabels[row.facilidade_uso] || row.facilidade_uso}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      ["nenhuma", "pouca"].includes(row.dificuldade_ferramentas_digitais)
                        ? "default"
                        : "destructive"
                    } className="text-xs">
                      {dificuldadeLabels[row.dificuldade_ferramentas_digitais] || row.dificuldade_ferramentas_digitais}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum feedback registrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
