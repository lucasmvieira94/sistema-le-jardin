import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, BellRing, X, RefreshCw, CheckCircle2, AlertTriangle, Clock, FileHeart, Pill, Sparkles } from "lucide-react";
import { useLembretesFuncionario, type Pendencia } from "@/hooks/useLembretesFuncionario";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useRef } from "react";

interface Props {
  funcionarioId: string;
  funcionarioNome: string;
  onAcaoLembrete?: (tipo: string) => void;
}

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  ponto_entrada: Clock,
  ponto_intervalo_inicio: Clock,
  ponto_intervalo_fim: Clock,
  ponto_saida: Clock,
  prontuario_pendente: FileHeart,
  prontuario_em_andamento: FileHeart,
  medicamento_horario: Pill,
};

const PRIORIDADE_STYLES: Record<string, string> = {
  alta: "border-destructive/40 bg-destructive/5",
  media: "border-amber-500/40 bg-amber-500/5",
  baixa: "border-muted bg-muted/20",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-amber-500 text-white",
  baixa: "bg-muted text-muted-foreground",
};

export default function PainelLembretes({ funcionarioId, funcionarioNome, onAcaoLembrete }: Props) {
  const { data, isLoading, recarregar, dispensarLembrete } = useLembretesFuncionario(funcionarioId);
  const { permission, sendNotification, requestPermission, isSupported } = useNotifications();
  const ultimasPendenciasRef = useRef<Set<string>>(new Set());

  // Dispara notificação push para novas pendências de alta prioridade
  useEffect(() => {
    if (!data || permission !== "granted") return;
    const novasAltas = data.pendencias.filter(
      (p) => p.prioridade === "alta" && !ultimasPendenciasRef.current.has(`${p.tipo}-${p.referencia_id ?? ""}`)
    );
    novasAltas.forEach((p) => {
      sendNotification(`⚠️ ${p.titulo}`, {
        body: p.descricao,
        tag: `lembrete-${p.tipo}`,
      });
    });
    ultimasPendenciasRef.current = new Set(
      data.pendencias.map((p) => `${p.tipo}-${p.referencia_id ?? ""}`)
    );
  }, [data, permission, sendNotification]);

  if (!data && isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analisando suas rotinas...</span>
        </CardContent>
      </Card>
    );
  }

  const pendencias = data?.pendencias ?? [];
  const temPendencias = pendencias.length > 0;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                Lembrete IA
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {temPendencias ? `${pendencias.length} item(ns) requer(em) atenção` : "Tudo em dia!"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isSupported && permission !== "granted" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={requestPermission}
                title="Ativar notificações"
              >
                <BellRing className="w-3.5 h-3.5 mr-1" />
                Ativar alertas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={recarregar}
              disabled={isLoading}
              title="Atualizar"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {data?.mensagem_ia && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-foreground italic">
            "{data.mensagem_ia}"
          </div>
        )}

        {!temPendencias ? (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-500/10 rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">
              Sem pendências detectadas. Bom trabalho, {funcionarioNome.split(" ")[0]}!
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {pendencias.map((p, idx) => (
              <LembreteCard
                key={`${p.tipo}-${idx}`}
                pendencia={p}
                onDispensar={() => dispensarLembrete(p)}
                onAcao={() => onAcaoLembrete?.(p.tipo)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LembreteCard({
  pendencia,
  onDispensar,
  onAcao,
}: {
  pendencia: Pendencia;
  onDispensar: () => void;
  onAcao: () => void;
}) {
  const Icon = ICONES[pendencia.tipo] ?? AlertTriangle;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        PRIORIDADE_STYLES[pendencia.prioridade] ?? PRIORIDADE_STYLES.baixa
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0 border">
          <Icon className="w-4 h-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-semibold text-foreground">{pendencia.titulo}</h4>
            <Badge className={cn("text-[10px] px-1.5 py-0", PRIORIDADE_BADGE[pendencia.prioridade])}>
              {pendencia.prioridade.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-line break-words">
            {pendencia.descricao}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onAcao}>
              Ir agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={onDispensar}
            >
              <X className="w-3 h-3 mr-1" /> Dispensar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}