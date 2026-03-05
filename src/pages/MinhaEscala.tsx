import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CalendarDays, ArrowLeft, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface HorarioEscala {
  data: string;
  entrada: string | null;
  saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  deve_trabalhar: boolean;
}

export default function MinhaEscala() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get("funcionario_id") || "";
  const funcionarioNome = searchParams.get("funcionario_nome") || "";
  const [horarios, setHorarios] = useState<HorarioEscala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escalaNome, setEscalaNome] = useState("");

  const hoje = new Date();
  const mesAtual = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!funcionarioId) return;
    carregarEscala();
    carregarNomeEscala();
  }, [funcionarioId]);

  const carregarNomeEscala = async () => {
    const { data } = await supabase
      .from("funcionarios")
      .select("escalas(nome, jornada_trabalho)")
      .eq("id", funcionarioId)
      .single();

    if (data?.escalas) {
      setEscalaNome((data.escalas as any).nome || "");
    }
  };

  const carregarEscala = async () => {
    try {
      setCarregando(true);
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      const dataInicio = primeiroDia.toISOString().split("T")[0];
      const dataFim = ultimoDia.toISOString().split("T")[0];

      const { data, error } = await supabase.rpc("preencher_horarios_por_escala", {
        p_funcionario_id: funcionarioId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      });

      if (error) {
        toast({ variant: "destructive", title: "Erro ao carregar escala", description: error.message });
        return;
      }

      setHorarios((data as HorarioEscala[]) || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setCarregando(false);
    }
  };

  const formatarData = (data: string) => {
    const d = new Date(data + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  const formatarHora = (h: string | null) => (h ? h.slice(0, 5) : "--:--");

  const isHoje = (data: string) => data === hoje.toISOString().split("T")[0];

  const diasTrabalhados = horarios.filter((h) => h.deve_trabalhar).length;
  const diasFolga = horarios.filter((h) => !h.deve_trabalhar).length;

  const handleVoltar = () => {
    navigate(`/funcionario-access`);
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Funcionário não identificado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={handleVoltar}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </div>

          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CalendarDays className="w-6 h-6 text-green-700" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-green-800">Minha Escala</h1>
            <p className="text-muted-foreground capitalize">{mesAtual}</p>
            <p className="text-sm text-muted-foreground">{decodeURIComponent(funcionarioNome)}</p>
            {escalaNome && (
              <Badge variant="outline" className="mt-2">{escalaNome}</Badge>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{diasTrabalhados}</p>
                <p className="text-xs text-muted-foreground">Dias de trabalho</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-gray-500">{diasFolga}</p>
                <p className="text-xs text-muted-foreground">Dias de folga</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabela de horários */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl">
          {carregando ? (
            <div className="text-center py-8 text-muted-foreground">Carregando escala...</div>
          ) : horarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma escala encontrada para este mês.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horarios.map((h) => (
                    <TableRow
                      key={h.data}
                      className={`${isHoje(h.data) ? "bg-green-50 font-semibold" : ""} ${!h.deve_trabalhar ? "opacity-60" : ""}`}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatarData(h.data)}
                        {isHoje(h.data) && (
                          <Badge className="ml-2 bg-green-600 text-white text-[10px]">Hoje</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.deve_trabalhar ? formatarHora(h.entrada) : "--:--"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.deve_trabalhar ? formatarHora(h.saida) : "--:--"}
                      </TableCell>
                      <TableCell className="text-center">
                        {h.deve_trabalhar ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Sun className="w-3 h-3 mr-1" /> Trabalho
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Moon className="w-3 h-3 mr-1" /> Folga
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
