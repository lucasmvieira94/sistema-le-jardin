import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Search, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import ProntuarioDetalhado from "@/components/prontuario/ProntuarioDetalhado";

interface CicloResumo {
  id: string;
  data_ciclo: string;
  status: string;
  data_encerramento: string | null;
  residente: {
    id: string;
    nome_completo: string;
    numero_prontuario: string;
    quarto: string;
  };
  totalRegistros: number;
  funcionarioNome: string | null;
}

export default function SupervisorProntuarios() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";

  const [ciclos, setCiclos] = useState<CicloResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [residentes, setResidentes] = useState<any[]>([]);
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [filtros, setFiltros] = useState({
    dataInicio: formatInTimeZone(new Date(), "America/Sao_Paulo", "yyyy-MM-dd"),
    dataFim: "",
    residente: "todos",
    status: "todos",
  });

  useEffect(() => {
    if (!funcionarioId) {
      navigate("/");
      return;
    }
    fetchResidentes();
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionarioId) fetchCiclos();
  }, [funcionarioId, filtros]);

  const fetchResidentes = async () => {
    const { data } = await supabase
      .from("residentes")
      .select("id, nome_completo, numero_prontuario")
      .eq("ativo", true)
      .order("nome_completo");
    setResidentes(data || []);
  };

  const fetchCiclos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("prontuario_ciclos")
        .select(`
          id, data_ciclo, status, data_encerramento,
          residente:residentes!inner(id, nome_completo, numero_prontuario, quarto)
        `)
        .order("data_ciclo", { ascending: false });

      if (filtros.dataInicio) query = query.gte("data_ciclo", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_ciclo", filtros.dataFim);
      if (filtros.residente !== "todos") query = query.eq("residente_id", filtros.residente);
      if (filtros.status !== "todos") query = query.eq("status", filtros.status);

      const { data: ciclosData, error } = await query;
      if (error) throw error;

      // For each cycle, get record count and last employee
      const enriched: CicloResumo[] = await Promise.all(
        (ciclosData || []).map(async (ciclo: any) => {
          const { count } = await supabase
            .from("prontuario_registros")
            .select("id", { count: "exact", head: true })
            .eq("ciclo_id", ciclo.id);

          const { data: lastReg } = await supabase
            .from("prontuario_registros")
            .select("funcionarios(nome_completo)")
            .eq("ciclo_id", ciclo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: ciclo.id,
            data_ciclo: ciclo.data_ciclo,
            status: ciclo.status,
            data_encerramento: ciclo.data_encerramento,
            residente: ciclo.residente,
            totalRegistros: count || 0,
            funcionarioNome: (lastReg?.funcionarios as any)?.nome_completo || null,
          };
        })
      );

      setCiclos(enriched);
    } catch (err) {
      console.error("Erro ao buscar ciclos:", err);
      toast({ title: "Erro ao carregar prontuários", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "encerrado":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            <CheckCircle className="w-3 h-3 mr-1" /> Encerrado
          </Badge>
        );
      case "completo":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" /> Completo
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" /> Em Andamento
          </Badge>
        );
    }
  };

  const totais = {
    total: ciclos.length,
    emAndamento: ciclos.filter((c) => c.status === "em_andamento").length,
    completos: ciclos.filter((c) => c.status === "completo" || c.status === "encerrado").length,
  };

  if (!funcionarioId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-green-800">
                  Painel do Supervisor
                </h1>
                <p className="text-sm text-muted-foreground">
                  Olá, {decodeURIComponent(funcionarioNome).split(" ")[0]}
                </p>
              </div>
            </div>
            <FileText className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{totais.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{totais.emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em Aberto</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{totais.completos}</p>
              <p className="text-xs text-muted-foreground">Finalizados</p>
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
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div>
              <Label className="text-xs">Residente</Label>
              <Select value={filtros.residente} onValueChange={(v) => setFiltros({ ...filtros, residente: v })}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {residentes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filtros.status} onValueChange={(v) => setFiltros({ ...filtros, status: v })}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-white">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : ciclos.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                Nenhum prontuário encontrado para os filtros selecionados.
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Residente</TableHead>
                      <TableHead className="hidden sm:table-cell">Quarto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Registros</TableHead>
                      <TableHead className="hidden sm:table-cell">Funcionário</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ciclos.map((ciclo) => (
                      <TableRow key={ciclo.id}>
                        <TableCell className="text-sm">
                          {new Date(ciclo.data_ciclo + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {ciclo.residente.nome_completo}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {ciclo.residente.quarto || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(ciclo.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-center">
                          {ciclo.totalRegistros}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {ciclo.funcionarioNome || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCicloId(ciclo.id);
                              setDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Prontuário</DialogTitle>
            </DialogHeader>
            {selectedCicloId && (
              <ProntuarioDetalhado cicloId={selectedCicloId} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
