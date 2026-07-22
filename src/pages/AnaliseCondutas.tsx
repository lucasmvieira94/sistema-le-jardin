import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Users, Coffee, LogOut as LogOutIcon, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnaliseCondutas, type AlertaConduta, type JustificativaAtraso, type TipoAlertaConduta } from "@/hooks/useAnaliseCondutas";
import { formatarData } from "@/utils/dateUtils";

const TIPO_META: Record<TipoAlertaConduta, { label: string; icon: any; cor: string }> = {
  atraso: { label: "Atraso", icon: Clock, cor: "border-amber-500 text-amber-700 bg-amber-50" },
  atrasos_recorrentes: { label: "Atrasos recorrentes", icon: TrendingUp, cor: "border-red-500 text-red-700 bg-red-50" },
  falta: { label: "Falta", icon: XCircle, cor: "border-red-500 text-red-700 bg-red-50" },
  saida_nao_registrada: { label: "Saída não registrada", icon: LogOutIcon, cor: "border-orange-500 text-orange-700 bg-orange-50" },
  intervalo_nao_registrado: { label: "Intervalo não registrado", icon: Coffee, cor: "border-blue-500 text-blue-700 bg-blue-50" },
};

export default function AnaliseCondutas() {
  const [dias, setDias] = useState(30);
  const { alertas, justificativas, loading, refresh } = useAnaliseCondutas(dias);
  const [filtroTipo, setFiltroTipo] = useState<TipoAlertaConduta | "todos">("todos");
  const [dialogJust, setDialogJust] = useState<JustificativaAtraso | null>(null);
  const [respostaGestor, setRespostaGestor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const alertasFiltrados = useMemo(
    () => (filtroTipo === "todos" ? alertas : alertas.filter((a) => a.tipo === filtroTipo)),
    [alertas, filtroTipo]
  );

  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of alertas) c[a.tipo] = (c[a.tipo] || 0) + 1;
    return c;
  }, [alertas]);

  const pendentes = justificativas.filter((j) => j.status === "pendente");

  const analisarJustificativa = async (aprovar: boolean) => {
    if (!dialogJust) return;
    setSalvando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("justificativas_atraso")
        .update({
          status: aprovar ? "aprovada" : "rejeitada",
          resposta_gestor: respostaGestor || null,
          analisado_por: userData.user?.id,
          analisado_em: new Date().toISOString(),
        })
        .eq("id", dialogJust.id);
      if (error) throw error;
      toast({ title: aprovar ? "Justificativa aprovada" : "Justificativa rejeitada" });
      setDialogJust(null);
      setRespostaGestor("");
      refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const badgeStatus = (s: JustificativaAtraso["status"]) => {
    if (s === "aprovada") return <Badge className="bg-green-600">Aprovada</Badge>;
    if (s === "rejeitada") return <Badge variant="destructive">Rejeitada</Badge>;
    return <Badge variant="outline" className="border-amber-500 text-amber-700">Pendente</Badge>;
  };

  return (
    <div className="container mx-auto max-w-6xl pt-12 font-heebo">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
            <AlertTriangle className="w-7 h-7" /> Análise de Condutas RH
          </h2>
          <p className="text-muted-foreground text-sm">
            Alertas automáticos de atrasos, faltas, saídas e intervalos não registrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
          </select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(Object.keys(TIPO_META) as TipoAlertaConduta[]).map((t) => {
          const meta = TIPO_META[t];
          const Icon = meta.icon;
          return (
            <Card key={t} className={`cursor-pointer transition ${filtroTipo === t ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFiltroTipo(filtroTipo === t ? "todos" : t)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs text-muted-foreground">{meta.label}</span>
                </div>
                <p className="text-2xl font-bold">{contagens[t] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="alertas">
        <TabsList>
          <TabsTrigger value="alertas">
            Alertas ({alertas.length})
          </TabsTrigger>
          <TabsTrigger value="justificativas">
            Justificativas {pendentes.length > 0 && <Badge className="ml-2 bg-amber-500">{pendentes.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alertas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {filtroTipo === "todos" ? "Todos os alertas" : TIPO_META[filtroTipo].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Analisando...</p>
              ) : alertasFiltrados.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhum alerta no período.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px] pr-3">
                  <div className="space-y-2">
                    {alertasFiltrados
                      .sort((a, b) => (a.data < b.data ? 1 : -1))
                      .map((a) => {
                        const meta = TIPO_META[a.tipo];
                        const Icon = meta.icon;
                        return (
                          <div key={a.id} className={`flex items-start gap-3 p-3 border rounded-lg ${meta.cor}`}>
                            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-sm">{a.funcionario_nome}</span>
                                <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {a.tipo === "atrasos_recorrentes" ? `nos últimos ${dias} dias` : formatarData(a.data)}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{a.descricao}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="justificativas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Justificativas de atraso</CardTitle>
            </CardHeader>
            <CardContent>
              {justificativas.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhuma justificativa enviada no período.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px] pr-3">
                  <div className="space-y-2">
                    {justificativas.map((j) => (
                      <div key={j.id} className="border rounded-lg p-3 bg-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{j.funcionario_nome}</span>
                              {badgeStatus(j.status)}
                              <span className="text-xs text-muted-foreground">
                                {formatarData(j.data)} • previsto {j.horario_previsto.slice(0,5)} • registrado {j.horario_registrado.slice(0,5)} ({j.minutos_atraso} min de atraso)
                              </span>
                            </div>
                            <p className="text-sm mt-2 whitespace-pre-wrap">{j.justificativa}</p>
                            {j.resposta_gestor && (
                              <p className="text-xs mt-2 text-muted-foreground border-l-2 border-primary pl-2">
                                <strong>Gestor:</strong> {j.resposta_gestor}
                              </p>
                            )}
                          </div>
                          {j.status === "pendente" && (
                            <Button size="sm" variant="outline" onClick={() => { setDialogJust(j); setRespostaGestor(""); }}>
                              Analisar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialogJust} onOpenChange={(o) => !o && setDialogJust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analisar justificativa</DialogTitle>
            <DialogDescription>
              {dialogJust && (
                <>
                  <strong>{dialogJust.funcionario_nome}</strong> — {formatarData(dialogJust.data)} — {dialogJust.minutos_atraso} min de atraso
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
              {dialogJust?.justificativa}
            </div>
            <div>
              <label className="text-sm font-medium">Resposta ao funcionário (opcional)</label>
              <Textarea
                value={respostaGestor}
                onChange={(e) => setRespostaGestor(e.target.value)}
                placeholder="Observações ao funcionário..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogJust(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" onClick={() => analisarJustificativa(false)} disabled={salvando}>
              Rejeitar
            </Button>
            <Button onClick={() => analisarJustificativa(true)} disabled={salvando}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}