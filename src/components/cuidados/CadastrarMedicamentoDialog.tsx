import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const VIAS = ["Oral", "Sublingual", "Tópica", "Inalatória", "Oftálmica", "Nasal", "Subcutânea", "Intramuscular", "Retal", "Sonda"];

/**
 * Cadastro de medicamento pela cuidadora (Portal de Cuidados).
 * Grava pela RPC `portal_cadastrar_medicamento`, que confere o passe do PIN
 * e o módulo Medicamentos no servidor e registra quem cadastrou.
 */
export default function CadastrarMedicamentoDialog({ open, onOpenChange, onSalvo }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSalvo: () => void;
}) {
  const { toast } = useToast();
  const [residentes, setResidentes] = useState<{ id: string; nome_completo: string; quarto: string | null }[]>([]);
  const [f, setF] = useState({ residente: "", nome: "", dosagem: "", via: "Oral", medico: "", inicio: "", fim: "", obs: "" });
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.rpc("portal_cuidados_residentes" as any).then(({ data }) => setResidentes((data as any[]) ?? []));
    setF({ residente: "", nome: "", dosagem: "", via: "Oral", medico: "", inicio: "", fim: "", obs: "" });
    setHorarios(["08:00"]);
  }, [open]);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const validos = horarios.filter((h) => /^\d{2}:\d{2}$/.test(h));
  const podeSalvar = f.residente && f.nome.trim().length >= 2 && f.dosagem.trim() && validos.length > 0 && !salvando;

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_cadastrar_medicamento" as any, {
      p_residente_id: f.residente, p_nome: f.nome, p_dosagem: f.dosagem, p_horarios: validos,
      p_via: f.via, p_prescrito_por: f.medico || null, p_data_inicio: f.inicio || null,
      p_data_fim: f.fim || null, p_observacoes: f.obs || null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível cadastrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Medicamento cadastrado", description: "Já aparece no mapa do dia." });
    onOpenChange(false);
    onSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar medicamento</DialogTitle>
          <DialogDescription>Confira a receita antes de salvar. O cadastro fica registrado com seu nome.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Residente *</Label>
            <Select value={f.residente} onValueChange={set("residente")}>
              <SelectTrigger><SelectValue placeholder="Escolha o residente" /></SelectTrigger>
              <SelectContent>
                {residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}{r.quarto ? ` · Quarto ${r.quarto}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Medicamento *</Label><Input value={f.nome} maxLength={120} onChange={(e) => set("nome")(e.target.value)} placeholder="Ex.: Losartana 50mg" /></div>
            <div><Label>Dose *</Label><Input value={f.dosagem} maxLength={80} onChange={(e) => set("dosagem")(e.target.value)} placeholder="Ex.: 1 comprimido" /></div>
          </div>
          <div>
            <Label>Horários *</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {horarios.map((h, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input type="time" className="w-28" value={h} onChange={(e) => setHorarios((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                  {horarios.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" aria-label="Remover horário" onClick={() => setHorarios((l) => l.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setHorarios((l) => [...l, ""])}><Plus className="mr-1 h-4 w-4" />Horário</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Via</Label>
              <Select value={f.via} onValueChange={set("via")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VIAS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Médico que receitou</Label><Input value={f.medico} maxLength={120} onChange={(e) => set("medico")(e.target.value)} /></div>
            <div><Label>Início</Label><Input type="date" value={f.inicio} onChange={(e) => set("inicio")(e.target.value)} /></div>
            <div><Label>Término (se houver)</Label><Input type="date" value={f.fim} onChange={(e) => set("fim")(e.target.value)} /></div>
          </div>
          <div><Label>Observações</Label><Textarea rows={2} maxLength={500} value={f.obs} onChange={(e) => set("obs")(e.target.value)} placeholder="Ex.: dar após o café" /></div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar} disabled={!podeSalvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
