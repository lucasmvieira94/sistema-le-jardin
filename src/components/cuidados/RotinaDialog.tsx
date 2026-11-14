import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/utils/dateUtils";
import { AFERICOES, DIAS, MOMENTOS, TIPOS, fimPorDuracao, rotinaSchema, type RotinaCuidado } from "@/utils/rotinasCuidados";
import { useResidentesPortal } from "./useResidentesPortal";

type Prazo = "sem" | "dias" | "data";

/** Cadastro/edição de procedimento, aferição ou orientação do residente. */
export default function RotinaDialog({ open, onOpenChange, rotina, residentePadrao, onSalvo }: {
  open: boolean; onOpenChange: (o: boolean) => void; rotina?: RotinaCuidado | null; residentePadrao?: string; onSalvo: () => void;
}) {
  const { toast } = useToast();
  const residentes = useResidentesPortal();
  const vazio = { residente: residentePadrao ?? "", titulo: "", tipo: "procedimento", instrucoes: "", frequencia: "horarios", horarios: ["08:00"], momento: null as string | null, tipo_afericao: null as string | null, dias_semana: [] as number[], inicio: hojeISO(), fim: null as string | null };
  const [f, setF] = useState(vazio);
  const [prazo, setPrazo] = useState<Prazo>("sem");
  const [dias, setDias] = useState("7");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (rotina) {
      setF({ residente: rotina.residente_id, titulo: rotina.titulo, tipo: rotina.tipo, instrucoes: rotina.instrucoes ?? "", frequencia: rotina.frequencia, horarios: rotina.horarios.map((h) => h.slice(0, 5)), momento: rotina.momento, tipo_afericao: rotina.tipo_afericao, dias_semana: rotina.dias_semana ?? [], inicio: rotina.inicio, fim: rotina.fim });
      setPrazo(rotina.fim ? "data" : "sem");
    } else { setF(vazio); setPrazo("sem"); setDias("7"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rotina, residentePadrao]);

  const fimCalculado = prazo === "sem" ? null : prazo === "dias" ? (Number(dias) > 0 ? fimPorDuracao(f.inicio, Math.min(365, Number(dias))) : null) : f.fim;
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const salvar = async () => {
    const dados = { ...f, fim: fimCalculado, frequencia: f.tipo === "orientacao" && f.frequencia === "horarios" && !f.horarios.length ? "momento" : f.frequencia };
    const v = rotinaSchema.safeParse(dados);
    if (!v.success) return toast({ title: v.error.issues[0].message, variant: "destructive" });
    setSalvando(true);
    const { error } = await supabase.rpc("portal_rotina_salvar" as any, {
      _id: rotina?.id ?? null, _residente_id: dados.residente, _titulo: dados.titulo, _tipo: dados.tipo, _instrucoes: dados.instrucoes,
      _frequencia: dados.frequencia, _horarios: dados.horarios, _momento: dados.momento, _tipo_afericao: dados.tipo_afericao,
      _dias_semana: dados.dias_semana, _inicio: dados.inicio, _fim: dados.fim,
    });
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: rotina ? "Rotina atualizada" : "Rotina cadastrada" }); onOpenChange(false); onSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rotina ? "Editar rotina" : "Nova rotina de cuidado"}</DialogTitle>
          <DialogDescription>Procedimentos, aferições e orientações. Remédios são cadastrados no Mapa de Medicamentos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Residente</Label>
            <Select value={f.residente} onValueChange={(v) => set({ residente: v })} disabled={!!rotina}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => (
              <button key={t} type="button" onClick={() => set({ tipo: t, frequencia: t === "orientacao" ? "momento" : f.frequencia, momento: t === "orientacao" ? f.momento ?? "banho" : f.momento })}
                className={`rounded-md py-2 text-sm font-medium ${f.tipo === t ? "bg-background shadow" : "text-muted-foreground"}`}>{TIPOS[t]}</button>
            ))}
          </div>
          {f.tipo === "afericao" && (
            <div><Label>O que aferir</Label>
              <Select value={f.tipo_afericao ?? ""} onValueChange={(v) => set({ tipo_afericao: v, titulo: f.titulo || `Aferir ${AFERICOES[v].toLowerCase()}` })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{Object.entries(AFERICOES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div><Label>Título</Label><Input maxLength={160} placeholder={f.tipo === "orientacao" ? "Ex.: Usar sabonete neutro" : "Ex.: Curativo no pé esquerdo"} value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} /></div>
          <div><Label>Como fazer</Label><Textarea rows={4} maxLength={4000} placeholder="Passo a passo, produtos, cuidados..." value={f.instrucoes} onChange={(e) => set({ instrucoes: e.target.value })} /></div>

          <div><Label>Quando</Label>
            <Select value={f.frequencia} onValueChange={(v) => set({ frequencia: v, momento: v === "momento" ? f.momento ?? "banho" : f.momento })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horarios">Em horários fixos</SelectItem>
                <SelectItem value="momento">Em um momento da rotina</SelectItem>
                <SelectItem value="plantao">Uma vez por plantão</SelectItem>
              </SelectContent>
            </Select></div>
          {f.frequencia === "horarios" && (
            <div className="flex flex-wrap gap-2">
              {f.horarios.map((h, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input type="time" className="w-28" value={h} onChange={(e) => set({ horarios: f.horarios.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {f.horarios.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => set({ horarios: f.horarios.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => set({ horarios: [...f.horarios, "12:00"] })}><Plus className="mr-1 h-3.5 w-3.5" />Horário</Button>
            </div>
          )}
          {f.frequencia === "momento" && (
            <Select value={f.momento ?? ""} onValueChange={(v) => set({ momento: v })}>
              <SelectTrigger><SelectValue placeholder="Momento" /></SelectTrigger>
              <SelectContent>{Object.entries(MOMENTOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div><Label>Dias da semana <span className="text-xs text-muted-foreground">(nenhum = todos)</span></Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button key={d} type="button" onClick={() => set({ dias_semana: f.dias_semana.includes(i) ? f.dias_semana.filter((x) => x !== i) : [...f.dias_semana, i].sort() })}
                  className={`h-9 w-11 rounded-md border text-xs font-medium ${f.dias_semana.includes(i) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{d}</button>
              ))}
            </div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={f.inicio} onChange={(e) => set({ inicio: e.target.value })} /></div>
            <div><Label>Duração</Label>
              <Select value={prazo} onValueChange={(v) => setPrazo(v as Prazo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sem">Contínuo</SelectItem><SelectItem value="dias">Por X dias</SelectItem><SelectItem value="data">Até uma data</SelectItem></SelectContent>
              </Select></div>
          </div>
          {prazo === "dias" && <div className="flex items-center gap-2"><Input type="number" min={1} max={365} className="w-24" value={dias} onChange={(e) => setDias(e.target.value)} /><span className="text-sm text-muted-foreground">dias{fimCalculado ? ` · até ${new Date(`${fimCalculado}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</span></div>}
          {prazo === "data" && <Input type="date" min={f.inicio} value={f.fim ?? ""} onChange={(e) => set({ fim: e.target.value || null })} />}
        </div>
        <DialogFooter><Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
