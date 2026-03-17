import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProntuarioDetalhado from "./ProntuarioDetalhado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Calendar, Clock } from "lucide-react";

interface CicloDetalhadoProps {
  cicloId: string;
}

export default function CicloDetalhado({ cicloId }: CicloDetalhadoProps) {
  const [loading, setLoading] = useState(true);
  const [ciclo, setCiclo] = useState<any>(null);
  const [registros, setRegistros] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [cicloId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cycle info
      const { data: cicloData } = await supabase
        .from("prontuario_ciclos")
        .select(`
          *,
          residente:residentes(id, nome_completo, numero_prontuario, quarto)
        `)
        .eq("id", cicloId)
        .single();

      setCiclo(cicloData);

      // Fetch all records in this cycle
      const { data: regs } = await supabase
        .from("prontuario_registros")
        .select(`*, funcionarios(nome_completo)`)
        .eq("ciclo_id", cicloId)
        .order("created_at", { ascending: false });

      setRegistros(regs || []);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ciclo) {
    return <p className="text-center text-muted-foreground p-4">Ciclo não encontrado.</p>;
  }

  const parseDescricao = (descricao: string) => {
    try {
      if (!descricao || descricao.trim() === "") return {};
      return JSON.parse(descricao);
    } catch {
      return { observacoes_gerais: descricao };
    }
  };

  // Find the main "prontuario_completo" record
  const registroPrincipal = registros.find((r) => r.tipo_registro === "prontuario_completo");
  const dadosPrincipal = registroPrincipal ? parseDescricao(registroPrincipal.descricao) : {};

  const statusLabel: Record<string, string> = {
    em_andamento: "Em Andamento",
    completo: "Completo",
    encerrado: "Encerrado",
  };

  const statusColor: Record<string, string> = {
    em_andamento: "bg-yellow-100 text-yellow-800",
    completo: "bg-green-100 text-green-800",
    encerrado: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-4">
      {/* Cycle Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              {ciclo.residente?.nome_completo || "Residente"}
            </CardTitle>
            <Badge className={statusColor[ciclo.status] || "bg-gray-100"}>
              {statusLabel[ciclo.status] || ciclo.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Data: {new Date(ciclo.data_ciclo + "T12:00:00").toLocaleDateString("pt-BR")}
          </div>
          {ciclo.residente?.quarto && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              Quarto: {ciclo.residente.quarto}
            </div>
          )}
          {ciclo.data_encerramento && (
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Encerrado em: {new Date(ciclo.data_encerramento).toLocaleString("pt-BR")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main prontuário detail */}
      {registroPrincipal && Object.keys(dadosPrincipal).length > 0 ? (
        <ProntuarioDetalhado
          dados={dadosPrincipal}
          prontuario={{
            ...registroPrincipal,
            residentes: ciclo.residente,
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {ciclo.status === "em_andamento"
              ? "Este prontuário ainda não foi preenchido."
              : "Nenhum registro detalhado disponível."}
          </CardContent>
        </Card>
      )}

      {/* Additional records */}
      {registros.filter((r) => r.tipo_registro !== "prontuario_completo").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registros Adicionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {registros
              .filter((r) => r.tipo_registro !== "prontuario_completo")
              .map((reg) => (
                <div key={reg.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{reg.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {reg.horario_registro?.substring(0, 5)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {reg.funcionarios?.nome_completo || "Funcionário não identificado"}
                  </p>
                  {reg.observacoes && (
                    <p className="mt-1 text-xs">{reg.observacoes}</p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
