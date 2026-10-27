import { useEffect, useState } from "react";
import { Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VIAS, useResidentesPortal, type ItemEstoque } from "./CadastrarMedicamentoDialog";

interface LoteEmergencia { estoque_id: string; medicamento_id: string; nome: string; quantidade: number; validade: string | null; situacao: string }

/**
 * Dose única de emergência (fora do mapa). Desconta 1 unidade do estoque do residente
 * ou do estoque de emergência da instituição; o servidor escolhe o lote que vence antes.
 */
export default function DoseEmergenciaDialog({ open, onOpenChange, onSalvo }: { open: boolean; onOpenChange: (v: boolean) => void; onSalvo: () => void }) {
  const { toast } = useToast();
  const residentes = useResidentesPortal(open);
  const [residente, setResidente] = useState("");
  const [origem, setOrigem] = useState<"residente" | "emergencia">("residente");
  const [opcoes, setOpcoes] = useState<{ medicamento_id: string; nome: string; qtd: number }[]>([]);
  const [f, setF] = useState({ med: "", dose: "", via: "Oral", motivo: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) { setResidente(""); setOrigem("residente"); setF({ med: "", dose: "", via: "Oral", motivo: "" }); } }, [open]);

  useEffect(() => {
    setF((s) => ({ ...s, med: "" })); setOpcoes([]);
    if (origem === "residente" && residente) {
      supabase.rpc("portal_estoque_residente" as any, { p_residente_id: residente }).then(({ data }) =>
        setOpcoes(((data as ItemEstoque[]) ?? []).filter((e) => Number(e.quantidade) > 0).map((e) => ({ medicamento_id: e.medicamento_id, nome: e.nome, qtd: Number(e.quantidade) }))));
    }
    if (origem === "emergencia") {
      supabase.rpc("portal_estoque_emergencia" as any).then(({ data }) => {
        const m = new Map<string, { medicamento_id: string; nome: string; qtd: number }>();
        for (const l of (data as LoteEmergencia[]) ?? []) {
          if (l.situacao === "vencido" || Number(l.quantidade) <= 0) continue;
          const o = m.get(l.medicamento_id) ?? { medicamento_id: l.medicamento_id, nome: l.nome, qtd: 0 };
          o.qtd += Number(l.quantidade); m.set(l.medicamento_id, o);
        }
        setOpcoes([...m.values()]);
      });
    }
  }, [origem, residente]);

  const pode = residente && f.med && f.dose.trim() && f.motivo.trim().length >= 5 && !salvando;
  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_dose_emergencia" as any, {
      p_residente_id: residente, p_origem: origem, p_medicamento_id: f.med, p_dosagem: f.dose, p_via: f.via, p_motivo: f.motivo,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Dose de emergência registrada", description: "1 unidade descontada do estoque." });
    onOpenChange(false); onSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Siren className="h-5 w-5 text-destructive" />Dose de emergência</DialogTitle>
          <DialogDescription>Registro único, fora do mapa. Fica gravado com seu nome, horário e motivo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Residente *</Label>
            <Select value={residente} onValueChange={setResidente}>
              <SelectTrigger><SelectValue placeholder="Escolha o residente" /></SelectTrigger>
              <SelectContent>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}{r.quarto ? ` · Quarto ${r.quarto}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>De onde sai o remédio? *</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([["residente", "Estoque do residente"], ["emergencia", "Estoque de emergência"]] as const).map(([v, n]) => (
                <button key={v} type="button" onClick={() => setOrigem(v)}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${origem === v ? "border-primary bg-primary/10 text-primary" : ""}`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Medicamento *</Label>
            <Select value={f.med} onValueChange={(v) => setF((s) => ({ ...s, med: v }))} disabled={!opcoes.length}>
              <SelectTrigger><SelectValue placeholder={opcoes.length ? "Escolha o remédio" : (origem === "residente" && !residente ? "Escolha o residente primeiro" : "Nenhum remédio com saldo")} /></SelectTrigger>
              <SelectContent>{opcoes.map((o) => <SelectItem key={o.medicamento_id} value={o.medicamento_id}>{o.nome} · {o.qtd} un.</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Dose *</Label><Input value={f.dose} maxLength={80} onChange={(e) => setF((s) => ({ ...s, dose: e.target.value }))} placeholder="Ex.: 20 gotas" /></div>
            <div>
              <Label>Via</Label>
              <Select value={f.via} onValueChange={(v) => setF((s) => ({ ...s, via: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VIAS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Motivo *</Label><Textarea rows={2} maxLength={500} value={f.motivo} onChange={(e) => setF((s) => ({ ...s, motivo: e.target.value }))} placeholder="Ex.: febre de 38,5 °C, orientação da enfermeira" /></div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={salvar} disabled={!pode}>{salvando ? "Registrando..." : "Registrar dose"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
