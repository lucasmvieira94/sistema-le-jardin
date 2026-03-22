import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, FileWarning, Ban, Gavel } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Advertencia = {
  id: string;
  tipo: string;
  motivo: string;
  descricao: string;
  data_ocorrencia: string;
  dias_suspensao: number | null;
  data_inicio_suspensao: string | null;
  data_fim_suspensao: string | null;
  testemunha_1: string | null;
  testemunha_2: string | null;
  funcionario_recusou_assinar: boolean;
  observacoes: string | null;
  created_at: string;
};

interface HistoricoAdvertenciasProps {
  funcionarioId: string;
  funcionarioNome: string;
}

const TIPO_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  advertencia_verbal: { label: "Advertência Verbal", variant: "secondary", icon: AlertTriangle },
  advertencia_escrita: { label: "Advertência Escrita", variant: "default", icon: FileWarning },
  suspensao: { label: "Suspensão", variant: "destructive", icon: Ban },
  justa_causa: { label: "Justa Causa", variant: "destructive", icon: Gavel },
};

export default function HistoricoAdvertencias({ funcionarioId, funcionarioNome }: HistoricoAdvertenciasProps) {
  const [registros, setRegistros] = useState<Advertencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("advertencias_suspensoes")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .order("data_ocorrencia", { ascending: false });
      setRegistros(data || []);
      setLoading(false);
    }
    fetch();
  }, [funcionarioId]);

  // Contadores
  const contadores = {
    advertencia_verbal: registros.filter(r => r.tipo === "advertencia_verbal").length,
    advertencia_escrita: registros.filter(r => r.tipo === "advertencia_escrita").length,
    suspensao: registros.filter(r => r.tipo === "suspensao").length,
    justa_causa: registros.filter(r => r.tipo === "justa_causa").length,
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="animate-spin w-4 h-4" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Histórico Disciplinar — {funcionarioNome}</h3>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="rounded-lg border p-3 text-center">
              <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{contadores[key as keyof typeof contadores]}</p>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {registros.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Nenhum registro disciplinar encontrado.</p>
      ) : (
        <div className="space-y-3">
          {registros.map(reg => {
            const cfg = TIPO_CONFIG[reg.tipo] || TIPO_CONFIG.advertencia_verbal;
            const Icon = cfg.icon;
            return (
              <div key={reg.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(reg.data_ocorrencia + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                <p className="text-sm font-medium">{reg.motivo}</p>
                <p className="text-sm text-muted-foreground">{reg.descricao}</p>

                {reg.tipo === "suspensao" && reg.dias_suspensao && (
                  <p className="text-sm">
                    <strong>Suspensão:</strong> {reg.dias_suspensao} dia(s)
                    {reg.data_inicio_suspensao && ` — de ${format(new Date(reg.data_inicio_suspensao), "dd/MM/yyyy")}`}
                    {reg.data_fim_suspensao && ` até ${format(new Date(reg.data_fim_suspensao), "dd/MM/yyyy")}`}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {reg.testemunha_1 && <span>Testemunha 1: {reg.testemunha_1}</span>}
                  {reg.testemunha_2 && <span>Testemunha 2: {reg.testemunha_2}</span>}
                  {reg.funcionario_recusou_assinar && (
                    <Badge variant="outline" className="text-xs border-destructive text-destructive">
                      Recusou assinar
                    </Badge>
                  )}
                </div>

                {reg.observacoes && (
                  <p className="text-xs text-muted-foreground italic">Obs: {reg.observacoes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
