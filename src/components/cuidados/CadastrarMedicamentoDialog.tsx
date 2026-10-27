import { useEffect, useState } from "react";
import { Plus, X, PackageOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export const VIAS = ["Oral", "Sublingual", "Tópica", "Inalatória", "Oftálmica", "Nasal", "Subcutânea", "Intramuscular", "Retal", "Sonda"];

export interface ItemEstoque { estoque_id: string; medicamento_id: string; nome: string; quantidade: number; lote: string | null; validade: string | null; no_mapa: boolean }

/** Lista residentes visíveis no portal (somente campos assistenciais). */
export function useResidentesPortal(ativo: boolean) {
  const [lista, setLista] = useState<{ id: string; nome_completo: string; quarto: string | null }[]>([]);
  useEffect(() => {
    if (ativo) supabase.rpc("portal_cuidados_residentes" as any).then(({ data }) => setLista((data as any[]) ?? []));
  }, [ativo]);
  return lista;
}

/**
 * Cadastro no mapa a partir do ESTOQUE do residente.
 * Só aparecem remédios com saldo; o servidor (`portal_cadastrar_medicamento`) confere de novo.
 */
export default function CadastrarMedicamentoDialog({ open, onOpenChange, onSalvo, onIrEstoque }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSalvo: () => void; onIrEstoque?: () => void;
}) {
  const { toast } = useToast();
  const residentes = useResidentesPortal(open);
  const [residente, setResidente] = useState("");
  const [estoque, setEstoque] = useState<ItemEstoque[] | null>(null);
  const [f, setF] = useState({ estoque: "", dosagem: "", via: "Oral", medico: "", inicio: "", fim: "", obs: "" });
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResidente(""); setEstoque(null); setHorarios(["08:00"]);
    setF({ estoque: "", dosagem: "", via: "Oral", medico: "", inicio: "", fim: "", obs: "" });
  }, [open]);

  useEffect(() => {
    if (!residente) return;
    setEstoque(null); setF((s) => ({ ...s, estoque: "" }));
    supabase.rpc("portal_estoque_residente" as any, { p_residente_id: residente }).then(({ data }) => setEstoque((data as ItemEstoque[]) ?? []));
  }, [residente]);

  const disponiveis = (estoque ?? []).filter((e) => Number(e.quantidade) > 0 && !e.no_mapa);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const validos = horarios.filter((h) => /^\d{2}:\d{2}$/.test(h));
  const podeSalvar = f.estoque && f.dosagem.trim() && validos.length > 0 && !salvando;

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_cadastrar_medicamento" as any, {
      p_estoque_id: f.estoque, p_dosagem: f.dosagem, p_horarios: validos, p_via: f.via,
      p_prescrito_por: f.medico || null, p_data_inicio: f.inicio || null, p_data_fim: f.fim || null, p_observacoes: f.obs || null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível cadastrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Adicionado ao mapa", description: "Já aparece no mapa do dia." });
    onOpenChange(false); onSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar no mapa</DialogTitle>
          <DialogDescription>Escolha um remédio que já esteja no estoque do residente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Residente *</Label>
            <Select value={residente} onValueChange={setResidente}>
              <SelectTrigger><SelectValue placeholder="Escolha o residente" /></SelectTrigger>
              <SelectContent>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}{r.quarto ? ` · Quarto ${r.quarto}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {residente && estoque !== null && disponiveis.length === 0 && (
            <div className="space-y-2 rounded-lg border border-dashed p-4 text-center text-sm">
              <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p>Nenhum remédio disponível no estoque deste residente (ou todos já estão no mapa).</p>
              {onIrEstoque && <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onIrEstoque(); }}>Dar entrada no estoque</Button>}
            </div>
          )}

          {disponiveis.length > 0 && (<>
            <div>
              <Label>Medicamento do estoque *</Label>
              <Select value={f.estoque} onValueChange={set("estoque")}>
                <SelectTrigger><SelectValue placeholder="Escolha o remédio" /></SelectTrigger>
                <SelectContent>{disponiveis.map((e) => <SelectItem key={e.estoque_id} value={e.estoque_id}>{e.nome} · {Number(e.quantidade)} un.</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Dose *</Label><Input value={f.dosagem} maxLength={80} onChange={(e) => set("dosagem")(e.target.value)} placeholder="Ex.: 1 comprimido" /></div>
            <div>
              <Label>Horários *</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {horarios.map((h, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input type="time" className="w-28" value={h} onChange={(e) => setHorarios((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                    {horarios.length > 1 && <Button type="button" size="icon" variant="ghost" aria-label="Remover horário" onClick={() => setHorarios((l) => l.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
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
          </>)}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar} disabled={!podeSalvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
