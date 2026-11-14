import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/utils/dateUtils";
import { eventoCuidadosSchema, type EventoCuidados } from "@/utils/agendaCuidados";
import { useResidentesPortal } from "./useResidentesPortal";

/** Cria ou edita um compromisso (consulta, exame...) de um residente. */
export default function EventoAgendaDialog({ open, onOpenChange, evento, residentePadrao, onSalvo }: {
  open: boolean; onOpenChange: (o: boolean) => void; evento?: EventoCuidados | null; residentePadrao?: string; onSalvo: () => void;
}) {
  const { toast } = useToast();
  const residentes = useResidentesPortal();
  const [f, setF] = useState({ residente: "", titulo: "", data: hojeISO(), horario: "", observacoes: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(evento ? { residente: evento.residente_id, titulo: evento.titulo, data: evento.data_evento, horario: evento.horario.slice(0, 5), observacoes: evento.observacoes ?? "" }
      : { residente: residentePadrao ?? "", titulo: "", data: hojeISO(), horario: "", observacoes: "" });
  }, [open, evento, residentePadrao]);

  const salvar = async () => {
    const v = eventoCuidadosSchema.safeParse(f);
    if (!v.success) return toast({ title: v.error.issues[0].message, variant: "destructive" });
    if (f.data < hojeISO()) return toast({ title: "Escolha hoje ou uma data futura", variant: "destructive" });
    setSalvando(true);
    const { error } = evento
      ? await supabase.rpc("portal_cuidados_editar_evento" as any, { _evento_id: evento.id, _titulo: f.titulo, _data: f.data, _horario: f.horario, _observacoes: f.observacoes })
      : await supabase.rpc("portal_cuidados_criar_evento" as any, { _residente_id: f.residente, _titulo: f.titulo, _data: f.data, _horario: f.horario, _observacoes: f.observacoes });
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: evento ? "Compromisso atualizado" : "Compromisso agendado" });
    onOpenChange(false); onSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{evento ? "Editar compromisso" : "Novo compromisso"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Residente</Label>
            <Select value={f.residente} onValueChange={(v) => setF({ ...f, residente: v })} disabled={!!evento}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}{r.quarto ? ` · Q${r.quarto}` : ""}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Compromisso</Label><Input maxLength={160} placeholder="Ex.: Consulta com cardiologista" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" min={hojeISO()} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
            <div><Label>Horário</Label><Input type="time" value={f.horario} onChange={(e) => setF({ ...f, horario: e.target.value })} /></div>
          </div>
          <div><Label>Observações</Label><Textarea rows={4} maxLength={4000} placeholder="Local, jejum, documentos, quem acompanha..." value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
