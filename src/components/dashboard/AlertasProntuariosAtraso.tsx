/**
 * Pendências do dia — monitoramento do prontuário em ciclo de 24h.
 * Mostra residentes sem lançamento hoje, turno diurno sem registro (após 20h)
 * e turno noturno anterior sem registro (após 08h). Possui filtro por tipo.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, ExternalLink } from "lucide-react";
import {
  noturnoAnteriorPendente,
  ontemCicloISO,
  pendenciasDoDia,
  type MonitoramentoResidente,
  type PendenciaDia,
} from "@/utils/prontuarioLancamentos";

const ROTULO: Record<PendenciaDia, string> = {
  sem_lancamento: "Sem lançamento hoje",
  diurno_pendente: "Turno diurno sem registro",
  noturno_pendente: "Turno noturno de ontem sem registro",
};

type Filtro = "todas" | PendenciaDia;

export default function AlertasProntuariosAtraso({ mostrarBotaoVer = true }: { mostrarBotaoVer?: boolean }) {
  const [hoje, setHoje] = useState<MonitoramentoResidente[]>([]);
  const [ontem, setOntem] = useState<MonitoramentoResidente[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const carregar = async () => {
      const rpc = supabase.rpc as unknown as (n: string, a?: object) => Promise<{ data: unknown; error: unknown }>;
      const [h, o] = await Promise.all([
        rpc("monitorar_prontuarios_dia"),
        rpc("monitorar_prontuarios_dia", { p_data: ontemCicloISO() }),
      ]);
      if (h.error || o.error) console.error("Erro ao monitorar prontuários:", h.error || o.error);
      setHoje((h.data as MonitoramentoResidente[]) || []);
      setOntem((o.data as MonitoramentoResidente[]) || []);
      setLoading(false);
    };
    carregar();
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const mapaOntem = new Map(ontem.map((m) => [m.residente_id, m]));
  const pendentes = hoje
    .map((m) => {
      const p = pendenciasDoDia(m);
      if (noturnoAnteriorPendente(mapaOntem.get(m.residente_id))) p.push("noturno_pendente");
      return { m, p };
    })
    .filter((x) => x.p.length > 0 && (filtro === "todas" || x.p.includes(filtro)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Pendências do dia ({pendentes.length})</CardTitle>
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger className="w-60 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pendências</SelectItem>
              <SelectItem value="sem_lancamento">Sem lançamento</SelectItem>
              <SelectItem value="diurno_pendente">Turno diurno pendente</SelectItem>
              <SelectItem value="noturno_pendente">Turno noturno pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência encontrada.</p>
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
              {mostrarBotaoVer && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                  onClick={() => navigate(`/controle-prontuarios`)}>
                  <ExternalLink className="w-3 h-3 mr-1" /> Ver
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
