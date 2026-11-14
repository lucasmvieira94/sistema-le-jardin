import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { avisosAgenda, type EventoCuidados } from "@/utils/agendaCuidados";

/** Compromissos de hoje na tela inicial + aviso ao entrar com os ainda não vistos. */
export default function AvisosDoDia({ onAbrirAgenda, onAbrirRotinas, pendentesRotina }: { onAbrirAgenda: () => void; onAbrirRotinas: () => void; pendentesRotina: number }) {
  const { toast } = useToast();
  const [eventos, setEventos] = useState<EventoCuidados[]>([]);
  const [popup, setPopup] = useState(false);
  const carregar = useCallback(async (abrir = false) => {
    const { data } = await supabase.rpc("portal_cuidados_agenda" as any);
    const lista = ((data as EventoCuidados[]) ?? []).filter((e) => !e.cancelado_em);
    setEventos(lista);
    if (abrir && avisosAgenda(lista).length) setPopup(true);
  }, []);
  useEffect(() => { carregar(true); }, [carregar]);
  const pendentes = avisosAgenda(eventos);

  const ver = async (id: string) => {
    const { error } = await supabase.rpc("portal_cuidados_ver_evento" as any, { _evento_id: id });
    if (error) return toast({ title: "Não foi possível marcar", description: error.message, variant: "destructive" });
    const { data } = await supabase.rpc("portal_cuidados_agenda" as any);
    const lista = ((data as EventoCuidados[]) ?? []).filter((e) => !e.cancelado_em);
    setEventos(lista); if (!avisosAgenda(lista).length) setPopup(false);
  };

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2">
        <Card className={pendentes.length ? "border-destructive/50" : ""}>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-primary" />Compromissos de hoje</h2>
              <Button size="sm" variant="ghost" onClick={onAbrirAgenda}>Agenda</Button>
            </div>
            {!eventos.length ? <p className="text-sm text-muted-foreground">Nenhum compromisso hoje.</p> : (
              <ul className="space-y-1.5">
                {eventos.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate"><b>{e.horario.slice(0, 5)}</b> {e.titulo} · {e.residente_nome}</span>
                    {e.visto_em ? <Badge variant="secondary" className="shrink-0"><CheckCircle2 className="mr-1 h-3 w-3" />Feito</Badge>
                      : <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => ver(e.id)}>Visto</Button>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition hover:border-primary" onClick={onAbrirRotinas}>
          <CardContent className="flex h-full items-center gap-3 p-4">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div><h2 className="font-semibold">Rotinas do dia</h2>
              <p className="text-sm text-muted-foreground">{pendentesRotina ? `${pendentesRotina} procedimento(s)/aferição(ões) pendente(s)` : "Nada pendente agora"}</p></div>
          </CardContent>
        </Card>
      </section>
      <Dialog open={popup} onOpenChange={setPopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-destructive" />Compromissos de hoje</DialogTitle>
            <DialogDescription>Ao marcar como visto, o aviso deixa de aparecer para os demais cuidadores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pendentes.map((e) => (
              <div key={e.id} className="rounded-lg border p-3">
                <p className="font-semibold">{e.horario.slice(0, 5)} · {e.titulo}</p>
                <p className="text-xs text-muted-foreground">{e.residente_nome}</p>
                {e.observacoes && <p className="mt-1 whitespace-pre-wrap text-sm">{e.observacoes}</p>}
                <Button size="sm" className="mt-2 w-full" onClick={() => ver(e.id)}><CheckCircle2 className="mr-1 h-4 w-4" />Marcar como visto</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
