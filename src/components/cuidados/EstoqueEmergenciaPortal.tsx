import { useEffect, useState } from "react";
import { Plus, ShieldPlus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Lote { estoque_id: string; nome: string; quantidade: number; minimo: number; lote: string | null; validade: string | null; situacao: string }
interface Mov { quando: string; tipo: string; nome: string; quantidade: number; lote: string | null; residente: string | null; responsavel: string | null; motivo: string | null }

const SIT: Record<string, { n: string; v: "destructive" | "secondary" | "outline" }> = {
  vencido: { n: "Vencido — não usar", v: "destructive" }, zerado: { n: "Zerado", v: "destructive" },
  vence_breve: { n: "Vence em até 30 dias", v: "secondary" }, baixo: { n: "Abaixo do mínimo", v: "secondary" }, ok: { n: "OK", v: "outline" },
};
const dataBR = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Estoque de emergência da instituição (somente supervisores): lotes, alertas, entradas e movimentações. */
export default function EstoqueEmergenciaPortal() {
  const { toast } = useToast();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [f, setF] = useState({ nome: "", qtd: "", lote: "", validade: "", minimo: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    supabase.rpc("portal_estoque_emergencia" as any).then(({ data }) => setLotes((data as Lote[]) ?? []));
    supabase.rpc("portal_movimentos_emergencia" as any, { p_limite: 50 }).then(({ data }) => setMovs((data as Mov[]) ?? []));
  };
  useEffect(carregar, []);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_entrada_estoque_emergencia" as any, {
      p_nome: f.nome, p_quantidade: Number(f.qtd), p_lote: f.lote, p_validade: f.validade, p_minimo: f.minimo ? Number(f.minimo) : null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Entrada registrada no estoque de emergência" });
    setF({ nome: "", qtd: "", lote: "", validade: "", minimo: "" }); carregar();
  };

  const alertas = lotes.filter((l) => l.situacao !== "ok").length;

  return (
    <div className="space-y-4">
      {alertas > 0 && <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{alertas} lote(s) precisam de atenção (vencidos, zerados, vencendo ou abaixo do mínimo).</p>}

      <Card><CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldPlus className="h-4 w-4 text-primary" />Entrada no estoque de emergência</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Medicamento *</Label>
            <Input list="meds-emerg" value={f.nome} maxLength={120} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Dipirona 500mg/ml" />
            <datalist id="meds-emerg">{[...new Set(lotes.map((l) => l.nome))].map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div><Label>Quantidade *</Label><Input type="number" min={1} inputMode="numeric" value={f.qtd} onChange={(e) => setF((s) => ({ ...s, qtd: e.target.value }))} /></div>
          <div><Label>Estoque mínimo</Label><Input type="number" min={0} inputMode="numeric" value={f.minimo} onChange={(e) => setF((s) => ({ ...s, minimo: e.target.value }))} /></div>
          <div><Label>Lote *</Label><Input value={f.lote} maxLength={40} onChange={(e) => setF((s) => ({ ...s, lote: e.target.value }))} /></div>
          <div><Label>Validade *</Label><Input type="date" value={f.validade} onChange={(e) => setF((s) => ({ ...s, validade: e.target.value }))} /></div>
        </div>
        <Button className="w-full sm:w-auto" onClick={salvar} disabled={salvando || f.nome.trim().length < 2 || !(Number(f.qtd) > 0) || !f.lote.trim() || !f.validade}>
          <Plus className="mr-1 h-4 w-4" />{salvando ? "Salvando..." : "Adicionar"}
        </Button>
      </CardContent></Card>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lotes</h3>
        {!lotes.length && <p className="text-sm text-muted-foreground">Nenhum remédio no estoque de emergência.</p>}
        {lotes.map((l) => (
          <div key={l.estoque_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.nome}</p>
              <p className="text-xs text-muted-foreground">{[l.lote && `Lote ${l.lote}`, l.validade && `Val. ${dataBR(l.validade)}`, `mín. ${Number(l.minimo)}`].filter(Boolean).join(" · ")}</p>
              <Badge variant={SIT[l.situacao]?.v ?? "outline"} className="mt-1 text-[10px]">{SIT[l.situacao]?.n ?? l.situacao}</Badge>
            </div>
            <p className="text-lg font-bold">{Number(l.quantidade)}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Movimentações</h3>
        {!movs.length && <p className="text-sm text-muted-foreground">Sem movimentações.</p>}
        {movs.map((m, i) => (
          <div key={i} className="flex items-start gap-3 border-b py-2 text-sm">
            {m.tipo === "entrada" ? <ArrowDownLeft className="mt-0.5 h-4 w-4 text-primary" /> : <ArrowUpRight className="mt-0.5 h-4 w-4 text-destructive" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.tipo === "entrada" ? "Entrada" : "Saída"} · {m.nome} · {Number(m.quantidade)} un.{m.lote ? ` (lote ${m.lote})` : ""}</p>
              <p className="text-xs text-muted-foreground">
                {formatInTimeZone(new Date(m.quando), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}{m.responsavel ? ` · ${m.responsavel}` : ""}{m.residente ? ` · para ${m.residente}` : ""}
              </p>
              {m.motivo && <p className="text-xs">{m.motivo}</p>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
