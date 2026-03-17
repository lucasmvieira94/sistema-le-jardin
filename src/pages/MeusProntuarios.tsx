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
import { ArrowLeft, Eye, Search, ClipboardList, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import CicloDetalhado from "@/components/prontuario/CicloDetalhado";

interface MeuRegistro {
  id: string;
  ciclo_id: string | null;
  data_registro: string;
  horario_registro: string;
  tipo_registro: string;
  titulo: string;
  residente_nome: string;
  residente_quarto: string;
  status_ciclo: string | null;
}

export default function MeusProntuarios() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";

  const [registros, setRegistros] = useState<MeuRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [residentes, setResidentes] = useState<any[]>([]);
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [filtros, setFiltros] = useState({
    dataInicio: formatInTimeZone(new Date(), "America/Sao_Paulo", "yyyy-MM-dd"),
    dataFim: "",
    residente: "todos",
  });

  useEffect(() => {
    if (!funcionarioId) {
      navigate("/");
      return;
    }
    fetchResidentes();
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionarioId) fetchRegistros();
  }, [funcionarioId, filtros]);

  const fetchResidentes = async () => {
    const { data } = await supabase
      .from("residentes")
      .select("id, nome_completo")
      .eq("ativo", true)
      .order("nome_completo");
    setResidentes(data || []);
  };

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("prontuario_registros")
        .select(`
          id, ciclo_id, data_registro, horario_registro, tipo_registro, titulo,
          residentes!inner(nome_completo, quarto),
          prontuario_ciclos(status)
        `)
        .eq("funcionario_id", funcionarioId)
        .order("data_registro", { ascending: false })
        .order("horario_registro", { ascending: false });

      if (filtros.dataInicio) query = query.gte("data_registro", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_registro", filtros.dataFim);
      if (filtros.residente !== "todos") query = query.eq("residente_id", filtros.residente);

      const { data, error } = await query;
      if (error) throw error;

      const mapped: MeuRegistro[] = (data || []).map((r: any) => ({
        id: r.id,
        ciclo_id: r.ciclo_id,
        data_registro: r.data_registro,
        horario_registro: r.horario_registro,
        tipo_registro: r.tipo_registro,
        titulo: r.titulo,
        residente_nome: r.residentes?.nome_completo || "N/A",
        residente_quarto: r.residentes?.quarto || "-",
        status_ciclo: r.prontuario_ciclos?.status || null,
      }));

      setRegistros(mapped);
    } catch (err) {
      console.error("Erro ao buscar registros:", err);
      toast({ title: "Erro ao carregar seus prontuários", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
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
      case "em_andamento":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" /> Em Andamento
          </Badge>
        );
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const tipoRegistroLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      prontuario_completo: "Prontuário Completo",
      alimentacao: "Alimentação",
      higiene: "Higiene",
      medicacao: "Medicação",
      atividade: "Atividade",
      observacao: "Observação",
    };
    return labels[tipo] || tipo.replace(/_/g, " ");
  };

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
                  Meus Prontuários
                </h1>
                <p className="text-sm text-muted-foreground">
                  Registros preenchidos por {decodeURIComponent(funcionarioNome).split(" ")[0]}
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
              <p className="text-2xl font-bold text-green-700">{registros.length}</p>
              <p className="text-xs text-muted-foreground">Total de Registros</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {new Set(registros.map((r) => r.residente_nome)).size}
              </p>
              <p className="text-xs text-muted-foreground">Residentes Atendidos</p>
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card className="bg-white">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : registros.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                Nenhum registro encontrado para os filtros selecionados.
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Residente</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="text-sm">
                          {new Date(reg.data_registro + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {reg.horario_registro?.substring(0, 5) || "-"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {reg.residente_nome}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {tipoRegistroLabel(reg.tipo_registro)}
                        </TableCell>
                        <TableCell>{getStatusBadge(reg.status_ciclo)}</TableCell>
                        <TableCell className="text-right">
                          {reg.ciclo_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCicloId(reg.ciclo_id);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
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
