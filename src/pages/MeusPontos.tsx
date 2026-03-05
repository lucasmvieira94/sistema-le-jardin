import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface RegistroPonto {
  id: string;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  observacoes: string | null;
}

export default function MeusPontos() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get("funcionario_id") || "";
  const funcionarioNome = searchParams.get("funcionario_nome") || "";
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorLabel = mesAnterior.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!funcionarioId) return;
    carregarRegistros();
  }, [funcionarioId]);

  const carregarRegistros = async () => {
    try {
      setCarregando(true);
      const primeiroDia = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1);
      const ultimoDia = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0);

      const dataInicio = primeiroDia.toISOString().split("T")[0];
      const dataFim = ultimoDia.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("registros_ponto")
        .select("id, data, entrada, intervalo_inicio, intervalo_fim, saida, observacoes")
        .eq("funcionario_id", funcionarioId)
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data");

      if (error) {
        toast({ variant: "destructive", title: "Erro ao carregar registros", description: error.message });
        return;
      }

      setRegistros(data || []);
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

  const calcularHorasTrabalhadas = (r: RegistroPonto): string => {
    if (!r.entrada || !r.saida) return "--:--";
    const [eh, em] = r.entrada.split(":").map(Number);
    const [sh, sm] = r.saida.split(":").map(Number);
    let totalMin = (sh * 60 + sm) - (eh * 60 + em);

    // Descontar intervalo
    if (r.intervalo_inicio && r.intervalo_fim) {
      const [iih, iim] = r.intervalo_inicio.split(":").map(Number);
      const [ifh, ifm] = r.intervalo_fim.split(":").map(Number);
      totalMin -= (ifh * 60 + ifm) - (iih * 60 + iim);
    }

    if (totalMin < 0) totalMin += 24 * 60; // turno noturno
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const diasTrabalhados = registros.filter((r) => r.entrada && r.saida).length;

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
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-700" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-blue-800">Meus Registros de Ponto</h1>
            <p className="text-muted-foreground capitalize">{mesAnteriorLabel}</p>
            <p className="text-sm text-muted-foreground">{decodeURIComponent(funcionarioNome)}</p>
          </div>

          <div className="flex justify-center">
            <Badge variant="outline" className="text-sm">
              {diasTrabalhados} dia(s) com registro
            </Badge>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl">
          {carregando ? (
            <div className="text-center py-8 text-muted-foreground">Carregando registros...</div>
          ) : registros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro de ponto encontrado para o mês anterior.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Int. Início</TableHead>
                    <TableHead>Int. Fim</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap font-medium">
                        {formatarData(r.data)}
                      </TableCell>
                      <TableCell className="text-sm">{formatarHora(r.entrada)}</TableCell>
                      <TableCell className="text-sm">{formatarHora(r.intervalo_inicio)}</TableCell>
                      <TableCell className="text-sm">{formatarHora(r.intervalo_fim)}</TableCell>
                      <TableCell className="text-sm">{formatarHora(r.saida)}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {calcularHorasTrabalhadas(r)}
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
