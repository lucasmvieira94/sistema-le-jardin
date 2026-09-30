/**
 * Quadro "Monitoramento do ponto": ausências de informação na apropriação de horas.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ExternalLink, RefreshCw } from "lucide-react";
import { useMonitoramentoPonto } from "@/hooks/useMonitoramentoPonto";
import {
  contarPorTipo,
  ROTULOS_PENDENCIA_PONTO,
  type TipoPendenciaPonto,
} from "@/utils/monitoramentoPonto";
import { formatarData } from "@/utils/dateUtils";

const DESTINO: Record<TipoPendenciaPonto, string> = {
  falta_nao_justificada: "/faltas",
  saida_nao_registrada: "/apropriacao",
  intervalo_irregular: "/analise-condutas",
  atraso_sem_justificativa: "/analise-condutas",
  fora_da_escala: "/apropriacao",
  afastamento_sem_anexo: "/faltas",
  folha_nao_publicada: "/relatorios",
  folha_nao_confirmada: "/relatorios",
};

const GRAVE: TipoPendenciaPonto[] = ["falta_nao_justificada", "saida_nao_registrada"];

export default function MonitoramentoPonto() {
  const [dias, setDias] = useState(7);
  const [filtro, setFiltro] = useState<"todas" | TipoPendenciaPonto>("todas");
  const { pendencias, loading, erro, recarregar } = useMonitoramentoPonto(dias);
  const navigate = useNavigate();

  const contagem = useMemo(() => contarPorTipo(pendencias), [pendencias]);
  const visiveis = filtro === "todas" ? pendencias : pendencias.filter((p) => p.tipo === filtro);
  const tiposComPendencia = (Object.keys(contagem) as TipoPendenciaPonto[]).filter((t) => contagem[t] > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Monitoramento do ponto ({pendencias.length})</CardTitle>
          </div>
          <div className="flex gap-2">
            <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Ontem e hoje</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={recarregar} aria-label="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {tiposComPendencia.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            <Badge variant={filtro === "todas" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFiltro("todas")}>
              Todas
            </Badge>
            {tiposComPendencia.map((t) => (
              <Badge key={t} variant={filtro === t ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFiltro(t)}>
                {ROTULOS_PENDENCIA_PONTO[t]}: {contagem[t]}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : erro ? (
          <p className="text-sm text-destructive text-center py-4">{erro}</p>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Tudo em dia no ponto.</p>
        ) : (
          visiveis.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{p.funcionario_nome}</p>
                  <Badge variant={GRAVE.includes(p.tipo) ? "destructive" : "secondary"} className="text-xs">
                    {ROTULOS_PENDENCIA_PONTO[p.tipo]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatarData(p.data)} · {p.descricao}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={() => navigate(DESTINO[p.tipo])}>
                <ExternalLink className="w-3 h-3 mr-1" /> Ver
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
