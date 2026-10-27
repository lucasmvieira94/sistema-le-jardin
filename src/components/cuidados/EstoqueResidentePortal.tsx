import { useEffect, useState } from "react";
import { Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useResidentesPortal, type ItemEstoque } from "./CadastrarMedicamentoDialog";

const dataBR = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/** Estoque de remédios de cada residente: consulta e entrada (soma ao que já existe). */
export default function EstoqueResidentePortal({ onAlterado }: { onAlterado: () => void }) {
  const { toast } = useToast();
  const residentes = useResidentesPortal(true);
  const [residente, setResidente] = useState("");
  const [itens, setItens] = useState<ItemEstoque[] | null>(null);
  const [f, setF] = useState({ nome: "", qtd: "", lote: "", validade: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = (id = residente) => {
    if (!id) return;
    supabase.rpc("portal_estoque_residente" as any, { p_residente_id: id }).then(({ data }) => setItens((data as ItemEstoque[]) ?? []));
  };
  useEffect(() => { setItens(null); carregar(); }, [residente]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_entrada_estoque_residente" as any, {
      p_residente_id: residente, p_nome: f.nome, p_quantidade: Number(f.qtd), p_lote: f.lote || null, p_validade: f.validade || null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Entrada registrada" });
    setF({ nome: "", qtd: "", lote: "", validade: "" });
    carregar(); onAlterado();
  };

  return (
    <div className="space-y-4">
      <Select value={residente} onValueChange={setResidente}>
        <SelectTrigger><SelectValue placeholder="Escolha o residente" /></SelectTrigger>
        <SelectContent>{residentes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome_completo}{r.quarto ? ` · Quarto ${r.quarto}` : ""}</SelectItem>)}</SelectContent>
      </Select>

      {residente && (<>
        <Card><CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Dar entrada no estoque</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Medicamento *</Label>
              <Input list="meds-estoque" value={f.nome} maxLength={120} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Losartana 50mg" />
              <datalist id="meds-estoque">{(itens ?? []).map((i) => <option key={i.estoque_id} value={i.nome} />)}</datalist>
            </div>
            <div><Label>Quantidade (unidades) *</Label><Input type="number" min={1} inputMode="numeric" value={f.qtd} onChange={(e) => setF((s) => ({ ...s, qtd: e.target.value }))} /></div>
            <div><Label>Lote</Label><Input value={f.lote} maxLength={40} onChange={(e) => setF((s) => ({ ...s, lote: e.target.value }))} /></div>
            <div><Label>Validade</Label><Input type="date" value={f.validade} onChange={(e) => setF((s) => ({ ...s, validade: e.target.value }))} /></div>
          </div>
          <Button className="w-full sm:w-auto" disabled={salvando || f.nome.trim().length < 2 || !(Number(f.qtd) > 0)} onClick={salvar}>
            <Plus className="mr-1 h-4 w-4" />{salvando ? "Salvando..." : "Adicionar ao estoque"}
          </Button>
        </CardContent></Card>

        <div className="space-y-2">
          {itens?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum remédio no estoque deste residente.</p>}
          {itens?.map((i) => (
            <div key={i.estoque_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <Package className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{i.nome}</p>
                <p className="text-xs text-muted-foreground">{[i.lote && `Lote ${i.lote}`, i.validade && `Val. ${dataBR(i.validade)}`].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${Number(i.quantidade) <= 0 ? "text-destructive" : ""}`}>{Number(i.quantidade)}</p>
                {i.no_mapa && <Badge variant="outline" className="text-[10px]">No mapa</Badge>}
              </div>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}
