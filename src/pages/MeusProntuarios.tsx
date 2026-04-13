import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Search, ClipboardList, CheckCircle, Calendar, ChevronRight, User } from "lucide-react";
import { useFuncionarioSession } from "@/hooks/useFuncionarioSession";
import CicloDetalhado from "@/components/prontuario/CicloDetalhado";
import { hojeISO, formatarData, formatarDataCompleta } from "@/utils/dateUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CicloFinalizado {
  id: string;
  data_ciclo: string;
  status: string;
  data_encerramento: string | null;
  residente_nome: string;
  residente_quarto: string | null;
}

interface DiaAgrupado {
  data: string;
  diaSemana: string;
  dataFormatada: string;
  ciclos: CicloFinalizado[];
}

export default function MeusProntuarios() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  useFuncionarioSession();

  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";

  const [diasAgrupados, setDiasAgrupados] = useState<DiaAgrupado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDia, setSelectedDia] = useState<DiaAgrupado | null>(null);
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [dialogCicloOpen, setDialogCicloOpen] = useState(false);

  // Filtros: últimos 7 dias por padrão
  const hoje = hojeISO();
  const seteDiasAtras = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return format(d, 'yyyy-MM-dd');
  })();

  const [filtros, setFiltros] = useState({
    dataInicio: seteDiasAtras,
    dataFim: hoje,
  });

  useEffect(() => {
    if (!funcionarioId) {
      navigate("/");
      return;
    }
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionarioId) fetchCiclosFinalizados();
  }, [funcionarioId, filtros]);

  const fetchCiclosFinalizados = async () => {
    setLoading(true);
    try {
      // Buscar ciclos encerrados que tenham registros deste funcionário
      // OU que tenham sido encerrados por este funcionário
      let query = supabase
        .from("prontuario_ciclos")
        .select(`
          id, data_ciclo, status, data_encerramento,
          residente:residentes!inner(nome_completo, quarto)
        `)
        .eq("status", "encerrado")
        .order("data_ciclo", { ascending: false });

      if (filtros.dataInicio) query = query.gte("data_ciclo", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_ciclo", filtros.dataFim);

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar apenas ciclos onde este funcionário participou
      const cicloIds = (data || []).map((c: any) => c.id);
      
      let ciclosDoFuncionario = new Set<string>();
      
      if (cicloIds.length > 0) {
        // Buscar em lotes para evitar limite
        const batchSize = 50;
        for (let i = 0; i < cicloIds.length; i += batchSize) {
          const batch = cicloIds.slice(i, i + batchSize);
          const { data: registros } = await supabase
            .from("prontuario_registros")
            .select("ciclo_id")
            .eq("funcionario_id", funcionarioId!)
            .in("ciclo_id", batch);
          
          (registros || []).forEach((r: any) => ciclosDoFuncionario.add(r.ciclo_id));
        }
      }

      const ciclosFiltrados: CicloFinalizado[] = (data || [])
        .filter((c: any) => ciclosDoFuncionario.has(c.id))
        .map((c: any) => ({
          id: c.id,
          data_ciclo: c.data_ciclo,
          status: c.status,
          data_encerramento: c.data_encerramento,
          residente_nome: c.residente?.nome_completo || "N/A",
          residente_quarto: c.residente?.quarto || null,
        }));

      // Agrupar por data
      const agrupado = new Map<string, CicloFinalizado[]>();
      ciclosFiltrados.forEach((ciclo) => {
        const existing = agrupado.get(ciclo.data_ciclo) || [];
        existing.push(ciclo);
        agrupado.set(ciclo.data_ciclo, existing);
      });

      const diasFormatados: DiaAgrupado[] = Array.from(agrupado.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([data, ciclos]) => {
          const dateObj = new Date(data + "T12:00:00");
          return {
            data,
            diaSemana: format(dateObj, "EEEE", { locale: ptBR }),
            dataFormatada: formatarData(data),
            ciclos,
          };
        });

      setDiasAgrupados(diasFormatados);
    } catch (err) {
      console.error("Erro ao buscar prontuários finalizados:", err);
      toast({ title: "Erro ao carregar prontuários", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalCiclos = diasAgrupados.reduce((acc, dia) => acc + dia.ciclos.length, 0);

  if (!funcionarioId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-green-800">
                  Meus Prontuários Finalizados
                </h1>
                <p className="text-sm text-muted-foreground">
                  Prontuários encerrados por {decodeURIComponent(funcionarioNome).split(" ")[0]}
                </p>
              </div>
            </div>
            <ClipboardList className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{totalCiclos}</p>
              <p className="text-xs text-muted-foreground">Prontuários Finalizados</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{diasAgrupados.length}</p>
              <p className="text-xs text-muted-foreground">Dias com Registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="w-4 h-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Grouped by day list OR day detail */}
        {selectedDia ? (
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDia(null)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <CardTitle className="text-base capitalize">
                    {selectedDia.diaSemana}, {selectedDia.dataFormatada}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedDia.ciclos.length} prontuário(s) finalizado(s)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-2">
                  {selectedDia.ciclos.map((ciclo) => (
                    <div
                      key={ciclo.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedCicloId(ciclo.id);
                        setDialogCicloOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{ciclo.residente_nome}</p>
                          {ciclo.residente_quarto && (
                            <p className="text-xs text-muted-foreground">Quarto: {ciclo.residente_quarto}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> Encerrado
                        </Badge>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  Carregando...
                </div>
              ) : diasAgrupados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium">Nenhum prontuário finalizado</p>
                  <p className="text-xs mt-1">Ajuste os filtros de data para ver outros períodos.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <div className="divide-y">
                    {diasAgrupados.map((dia) => (
                      <div
                        key={dia.data}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedDia(dia)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-green-700" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{dia.dataFormatada}</p>
                            <p className="text-xs text-muted-foreground capitalize">{dia.diaSemana}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            {dia.ciclos.length} prontuário{dia.ciclos.length !== 1 ? 's' : ''}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ciclo Detail Dialog */}
        <Dialog open={dialogCicloOpen} onOpenChange={setDialogCicloOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Prontuário</DialogTitle>
            </DialogHeader>
            {selectedCicloId && <CicloDetalhado cicloId={selectedCicloId} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
