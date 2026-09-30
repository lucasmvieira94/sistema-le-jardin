/**
 * Pendências do dia — monitoramento do prontuário em ciclo de 24h.
 * Não há mais "atraso" nem finalização manual: o dia fica aberto até 23h59
 * e é encerrado automaticamente. Aqui a gestão vê quem ainda não recebeu
 * lançamentos ou teve o turno diurno sem registro.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, ExternalLink } from "lucide-react";
import { pendenciasDoDia, type MonitoramentoResidente } from "@/utils/prontuarioLancamentos";

const ROTULO = {
  sem_lancamento: "Sem lançamento hoje",
  diurno_pendente: "Turno diurno sem registro",
} as const;

export default function AlertasProntuariosAtraso() {
  const [itens, setItens] = useState<MonitoramentoResidente[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const carregar = async () => {
      const { data, error } = await supabase.rpc("monitorar_prontuarios_dia" as never);
      if (error) console.error("Erro ao monitorar prontuários:", error);
      setItens(((data as unknown) as MonitoramentoResidente[]) || []);
      setLoading(false);
    };
    carregar();
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const pendentes = itens
    .map((m) => ({ m, p: pendenciasDoDia(m) }))
    .filter((x) => x.p.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Pendências do dia ({pendentes.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os residentes têm lançamentos hoje.
          </p>
        ) : (
          pendentes.map(({ m, p }) => (
            <div key={m.residente_id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="space-y-1">
                <p className="font-medium text-sm">{m.residente_nome}</p>
                <div className="flex flex-wrap gap-1">
                  {p.map((x) => (
                    <Badge key={x} variant={x === "sem_lancamento" ? "destructive" : "secondary"} className="text-xs">
                      {ROTULO[x]}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                onClick={() => navigate(`/controle-prontuarios`)}>
                <ExternalLink className="w-3 h-3 mr-1" /> Ver
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
