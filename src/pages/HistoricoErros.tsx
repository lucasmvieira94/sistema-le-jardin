import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bug, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { formatarTimestampDataHora } from "@/utils/formatTimestamp";
import { ErroSistema, FiltrosErros, filtrarErros, limitesPeriodo, resumoPorModulo } from "@/utils/historicoErros";

const COR_GRAVIDADE: Record<string, "destructive" | "secondary" | "outline"> = {
  alta: "destructive", media: "secondary", baixa: "outline",
};

/** Tela administrativa: histórico de erros diagnosticados pelo agente de suporte. */
export default function HistoricoErros() {
  const { user } = useAuthSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const trintaDias = new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [f, setF] = useState<FiltrosErros>({ modulo: "todos", gravidade: "todas", status: "abertos", de: trintaDias, ate: hoje });
  const [aberto, setAberto] = useState<ErroSistema | null>(null);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Busca o período no banco; módulo/gravidade/status são filtrados na tela.
  const { data = [], isLoading } = useQuery({
    queryKey: ["historico-erros", f.de, f.ate],
    queryFn: async () => {
      const { inicio, fim } = limitesPeriodo(f.de, f.ate);
      let q = supabase.from("erros_envio_suporte" as any).select("*").order("created_at", { ascending: false }).limit(1000);
      if (inicio) q = q.gte("created_at", inicio);
      if (fim) q = q.lte("created_at", fim);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ErroSistema[];
    },
  });

  const modulos = useMemo(() => [...new Set(data.map((e) => e.origem))].sort(), [data]);
  const filtrados = useMemo(() => filtrarErros(data, f), [data, f]);
  const resumo = useMemo(() => resumoPorModulo(filtrarErros(data, { ...f, modulo: "todos" })), [data, f]);

  const alterarStatus = async (resolver: boolean) => {
    if (!aberto) return;
    setSalvando(true);
    const { error } = await supabase.from("erros_envio_suporte" as any).update({
      resolvido: resolver, resolvido_em: resolver ? new Date().toISOString() : null,
      resolvido_por: resolver ? user?.id : null, observacao_resolucao: resolver ? obs.trim() || null : null,
    }).eq("id", aberto.id);
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: resolver ? "Erro marcado como resolvido" : "Erro reaberto" });
    setAberto(null);
    qc.invalidateQueries({ queryKey: ["historico-erros"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Bug className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Histórico de erros</h1>
          <p className="text-sm text-muted-foreground">Falhas do sistema analisadas pelo assistente de IA, por módulo.</p>
        </div>
      </div>

      <Card className="p-4 grid gap-3 grid-cols-2 md:grid-cols-5">
        <label className="text-xs space-y-1">De<Input type="date" value={f.de ?? ""} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
        <label className="text-xs space-y-1">Até<Input type="date" value={f.ate ?? ""} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
        <label className="text-xs space-y-1">Módulo
          <Select value={f.modulo} onValueChange={(v) => setF({ ...f, modulo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="text-xs space-y-1">Gravidade
          <Select value={f.gravidade} onValueChange={(v) => setF({ ...f, gravidade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem><SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs space-y-1">Situação
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as FiltrosErros["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem><SelectItem value="abertos">Em aberto</SelectItem>
              <SelectItem value="resolvidos">Resolvidos</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </Card>

      {resumo.length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {resumo.map((r) => (
            <button key={r.modulo} onClick={() => setF({ ...f, modulo: f.modulo === r.modulo ? "todos" : r.modulo })}
              className={`text-left rounded-lg border p-3 transition-colors hover:bg-muted ${f.modulo === r.modulo ? "border-primary bg-muted" : "border-border"}`}>
              <p className="text-sm font-medium truncate">{r.modulo}</p>
              <p className="text-2xl font-semibold">{r.total}</p>
              <p className="text-xs text-muted-foreground">{r.abertos} em aberto · {r.altas} alta(s)</p>
            </button>
          ))}
        </div>
      )}

      <Card className="divide-y divide-border">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum erro encontrado com esses filtros.</p>
        ) : filtrados.map((e) => (
          <button key={e.id} onClick={() => { setAberto(e); setObs(e.observacao_resolucao ?? ""); }}
            className="w-full text-left p-4 hover:bg-muted/50 flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline">{e.origem}</Badge>
                <Badge variant={COR_GRAVIDADE[e.gravidade ?? "media"] ?? "secondary"}>{e.gravidade ?? "media"}</Badge>
                {e.resolvido && <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" />Resolvido</Badge>}
              </div>
              <p className="text-sm truncate">{e.erro}</p>
              {e.diagnostico && <p className="text-xs text-muted-foreground truncate">{e.diagnostico}</p>}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatarTimestampDataHora(e.created_at)}</span>
          </button>
        ))}
      </Card>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {aberto && (<>
            <DialogHeader><DialogTitle>{aberto.origem} — {formatarTimestampDataHora(aberto.created_at)}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><p className="font-medium">Erro</p><p className="text-muted-foreground break-words">{aberto.erro}</p></div>
              <div><p className="font-medium">Diagnóstico da IA</p><p className="text-muted-foreground">{aberto.diagnostico || "—"}</p></div>
              <div><p className="font-medium">Sugestão de correção</p><p className="text-muted-foreground">{aberto.sugestao || "—"}</p></div>
              <details><summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(aberto.contexto, null, 2)}</pre>
              </details>
              {aberto.resolvido ? (
                <p className="text-muted-foreground">Resolvido em {aberto.resolvido_em ? formatarTimestampDataHora(aberto.resolvido_em) : "—"}{aberto.observacao_resolucao ? ` — ${aberto.observacao_resolucao}` : ""}</p>
              ) : (
                <Textarea placeholder="O que foi feito para resolver (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} />
              )}
            </div>
            <DialogFooter>
              {aberto.resolvido ? (
                <Button variant="outline" onClick={() => alterarStatus(false)} disabled={salvando}><RotateCcw className="w-4 h-4 mr-1" />Reabrir</Button>
              ) : (
                <Button onClick={() => alterarStatus(true)} disabled={salvando}><CheckCircle2 className="w-4 h-4 mr-1" />Marcar como resolvido</Button>
              )}
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
