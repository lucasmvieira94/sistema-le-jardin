import { useCallback, useEffect, useState } from "react";
import { Plus, StickyNote, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export type Observacao = { id: string; texto: string; valida_ate: string | null; autor: string | null; created_at: string;
  status?: string; motivo_remocao?: string | null; vencida?: boolean };

const dataBR = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const dataHora = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Validade exibida: sem prazo (padrão) ou data final. */
export const textoValidade = (v: string | null) => (v ? `Vale até ${dataBR(v)}` : "Sem prazo");

/**
 * Observações do residente.
 * - portal: cuidadora vê as ativas, cria e pede exclusão (gestor decide).
 * - gestor: vê todas (inclusive vencidas/removidas), cria e exclui direto com motivo.
 */
export default function ObservacoesResidente({ residenteId, modo, onTotal }: { residenteId: string; modo: "portal" | "gestor"; onTotal?: (n: number) => void }) {
  const { toast } = useToast();
  const [lista, setLista] = useState<Observacao[] | null>(null);
  const [novo, setNovo] = useState(false);
  const [texto, setTexto] = useState("");
  const [comPrazo, setComPrazo] = useState("nao");
  const [validade, setValidade] = useState("");
  const [excluir, setExcluir] = useState<Observacao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const fn = modo === "portal" ? "portal_observacoes_residente" : "gestor_observacoes_residente";
    const { data, error } = await supabase.rpc(fn as any, { p_residente_id: residenteId });
    if (error) { setLista([]); return; }
    const itens = (data as Observacao[]) ?? [];
    setLista(itens);
    onTotal?.(itens.filter((o) => (o.status ?? "ativa") === "ativa" && !o.vencida).length);
  }, [residenteId, modo, onTotal]);
  useEffect(() => { void carregar(); }, [carregar]);

  const criar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc((modo === "portal" ? "portal_criar_observacao" : "gestor_criar_observacao") as any, {
      p_residente_id: residenteId, p_texto: texto, p_valida_ate: comPrazo === "sim" ? validade : null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Observação adicionada" });
    setNovo(false); setTexto(""); setComPrazo("nao"); setValidade(""); void carregar();
  };

  const remover = async () => {
    if (!excluir) return;
    setSalvando(true);
    const { error } = modo === "portal"
      ? await supabase.rpc("portal_solicitar_remocao_observacao" as any, { p_id: excluir.id, p_motivo: motivo })
      : await supabase.rpc("gestor_remover_observacao" as any, { p_id: excluir.id, p_motivo: motivo });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: modo === "portal" ? "Exclusão enviada ao gestor" : "Observação excluída",
      description: modo === "portal" ? "A observação fica fora da ficha até o gestor decidir." : undefined });
    setExcluir(null); setMotivo(""); void carregar();
  };

  const podeSalvar = texto.trim().length >= 3 && (comPrazo === "nao" || (validade && validade >= hojeBR()));

  return (
    <div className="space-y-3">
      <Button className="w-full sm:w-auto" onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Nova observação</Button>
      {lista?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma observação para este residente.</p>}
      {lista?.map((o) => {
        const inativa = (o.status && o.status !== "ativa") || o.vencida;
        return (
          <article key={o.id} className={`flex gap-3 rounded-xl border bg-card p-3 ${inativa ? "opacity-60" : ""}`}>
            <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="whitespace-pre-wrap text-sm">{o.texto}</p>
              <p className="text-xs text-muted-foreground">{o.autor ?? "—"} · {dataHora(o.created_at)}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{textoValidade(o.valida_ate)}</Badge>
                {o.vencida && <Badge variant="secondary" className="text-[10px]">Vencida</Badge>}
                {o.status === "remocao_pendente" && <Badge variant="secondary" className="text-[10px]">Exclusão aguardando decisão</Badge>}
                {o.status === "removida" && <Badge variant="destructive" className="text-[10px]">Removida</Badge>}
              </div>
              {o.motivo_remocao && o.status !== "ativa" && <p className="text-xs text-muted-foreground">Motivo: {o.motivo_remocao}</p>}
            </div>
            {(o.status ?? "ativa") !== "removida" && (
              <Button variant="ghost" size="icon" aria-label="Excluir observação" onClick={() => { setMotivo(""); setExcluir(o); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </article>
        );
      })}

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova observação</DialogTitle>
            <DialogDescription>Informações importantes para todos os plantões e para cuidadoras novas.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="obs-texto">Observação *</Label>
          <Textarea id="obs-texto" value={texto} maxLength={1000} rows={5} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: prefere banho à tarde; usar talheres adaptados" />
          <p className="text-right text-xs text-muted-foreground">{texto.length}/1000</p>
          <Label>Validade</Label>
          <RadioGroup value={comPrazo} onValueChange={setComPrazo} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="nao" />Sem prazo</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="sim" />Até uma data</label>
          </RadioGroup>
          {comPrazo === "sim" && <Input type="date" aria-label="Válida até" min={hojeBR()} value={validade} onChange={(e) => setValidade(e.target.value)} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button disabled={salvando || !podeSalvar} onClick={criar}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir observação?</DialogTitle>
            <DialogDescription>{modo === "portal"
              ? "A observação sai da ficha agora e o gestor decide. Se ele recusar, ela volta."
              : "A observação será removida. O motivo fica registrado."}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="obs-motivo">Por que excluir? *</Label>
          <Textarea id="obs-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: informação não vale mais" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={salvando || motivo.trim().length < 10} onClick={remover}>{salvando ? "Enviando..." : modo === "portal" ? "Pedir exclusão" : "Excluir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
