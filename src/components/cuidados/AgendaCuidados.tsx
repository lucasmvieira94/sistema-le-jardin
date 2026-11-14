import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Pencil, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/utils/dateUtils";
import type { EventoCuidados } from "@/utils/agendaCuidados";
import { TituloTarefa } from "./PortalCuidadosContexto";
import EventoAgendaDialog from "./EventoAgendaDialog";
import { useResidentesPortal } from "./useResidentesPortal";

const somaDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const diaBR = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Agenda de compromissos dos residentes: hoje e próximos 7 dias, com ciência compartilhada. */
export default function AgendaCuidados() {
  const { toast } = useToast();
  const residentes = useResidentesPortal();
  const [inicio, setInicio] = useState(hojeISO());
  const [residente, setResidente] = useState("todos");
  const [eventos, setEventos] = useState<EventoCuidados[] | null>(null);
  const [editar, setEditar] = useState<EventoCuidados | null | undefined>(undefined);
  const [cancelar, setCancelar] = useState<EventoCuidados | null>(null);
  const [motivo, setMotivo] = useState("");
  const hoje = hojeISO();

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("portal_cuidados_agenda_periodo" as any, { _inicio: inicio, _fim: somaDias(inicio, 6), _residente_id: residente === "todos" ? null : residente });
    if (error) { toast({ title: "Não foi possível abrir a agenda", description: error.message, variant: "destructive" }); setEventos([]); }
    else setEventos((data as EventoCuidados[]) ?? []);
  }, [inicio, residente, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const porDia = useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(inicio, i)).map((d) => ({ d, itens: (eventos ?? []).filter((e) => e.data_evento === d) })), [eventos, inicio]);

  const ver = async (e: EventoCuidados) => {
    const { error } = await supabase.rpc("portal_cuidados_ver_evento" as any, { _evento_id: e.id });
    if (error) toast({ title: "Não foi possível marcar", description: error.message, variant: "destructive" }); else carregar();
  };
  const confirmarCancelamento = async () => {
    const { error } = await supabase.rpc("portal_cuidados_cancelar_evento" as any, { _evento_id: cancelar!.id, _motivo: motivo });
    if (error) return toast({ title: "Não foi possível cancelar", description: error.message, variant: "destructive" });
    toast({ title: "Compromisso cancelado" }); setCancelar(null); setMotivo(""); carregar();
  };

  return (
    <div className="container mx-auto px-3 py-5 sm:px-4">
      <TituloTarefa icone={CalendarDays} titulo="Agenda" descricao="Consultas, exames e compromissos dos residentes"
        acao={<Button onClick={() => setEditar(null)}><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Novo</span></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setInicio(somaDias(inicio, -7))} disabled={inicio <= hoje} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-40" value={inicio} onChange={(e) => e.target.value && setInicio(e.target.value)} />
        <Button variant="outline" size="icon" onClick={() => setInicio(somaDias(inicio, 7))} aria-label="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
        {inicio !== hoje && <Button variant="ghost" size="sm" onClick={() => setInicio(hoje)}>Hoje</Button>}
        <Select value={residente} onValueChange={setResidente}>
          <SelectTrigger className="w-full sm:w-60"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os residentes</SelectItem>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {porDia.map(({ d, itens }) => (
          <section key={d}>
            <h3 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">{d === hoje ? "Hoje · " : ""}{diaBR(d)}</h3>
            {!itens.length ? <p className="text-xs text-muted-foreground">Sem compromissos.</p> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {itens.map((e) => (
                  <Card key={e.id} className={e.cancelado_em ? "opacity-60" : e.visto_em ? "border-primary/30" : d === hoje ? "border-destructive/50" : ""}>
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-semibold ${e.cancelado_em ? "line-through" : ""}`}><Clock className="mr-1 inline h-3.5 w-3.5" />{e.horario.slice(0, 5)} · {e.titulo}</p>
                          <p className="text-xs text-muted-foreground">{e.residente_nome}</p>
                        </div>
                        {e.cancelado_em ? <Badge variant="outline">Cancelado</Badge> : e.visto_em ? <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />Feito</Badge> : null}
                      </div>
                      {e.observacoes && <p className="whitespace-pre-wrap text-sm">{e.observacoes}</p>}
                      {e.visto_em && <p className="text-xs text-muted-foreground">Visto por {e.visto_por_nome} às {horaBR(e.visto_em)}</p>}
                      {e.cancelado_em && <p className="text-xs text-muted-foreground">Motivo: {e.motivo_cancelamento}</p>}
                      {!e.cancelado_em && d >= hoje && (
                        <div className="flex flex-wrap gap-2">
                          {d === hoje && !e.visto_em && <Button size="sm" onClick={() => ver(e)}><CheckCircle2 className="mr-1 h-4 w-4" />Marcar como visto</Button>}
                          {!e.visto_em && <Button size="sm" variant="outline" onClick={() => setEditar(e)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>}
                          <Button size="sm" variant="ghost" onClick={() => setCancelar(e)}><XCircle className="mr-1 h-3.5 w-3.5" />Cancelar</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      <EventoAgendaDialog open={editar !== undefined} onOpenChange={(o) => !o && setEditar(undefined)} evento={editar} residentePadrao={residente === "todos" ? undefined : residente} onSalvo={carregar} />
      <Dialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancelar compromisso</DialogTitle></DialogHeader>
          <p className="text-sm">{cancelar?.titulo} — {cancelar?.residente_nome}</p>
          <Textarea placeholder="Motivo (obrigatório)" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter><Button variant="destructive" disabled={motivo.trim().length < 3} onClick={confirmarCancelamento}>Cancelar compromisso</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
