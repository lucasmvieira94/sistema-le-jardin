import { useState } from "react";
import { CheckCircle2, ClipboardList, Info, Loader2, Pencil, Plus, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AFERICOES, MOMENTOS, TIPOS, descreverFrequencia, type Ocorrencia, type RotinaCuidado } from "@/utils/rotinasCuidados";
import { TituloTarefa } from "./PortalCuidadosContexto";
import RotinaDialog from "./RotinaDialog";
import { useRotinasDia } from "./useRotinasDia";
import { ListaAnexos } from "./AnexosRotina";

const COR: Record<string, string> = { atrasado: "border-destructive bg-destructive/5", agora: "border-primary bg-primary/5", proximo: "", feito: "opacity-70" };
const ROTULO: Record<string, string> = { atrasado: "Atrasado", agora: "Agora", proximo: "Próximo", feito: "Feito" };
const PLACEHOLDER: Record<string, string> = { pressao: "Ex.: 12x8", glicemia: "Ex.: 110 mg/dL", temperatura: "Ex.: 36,5", saturacao: "Ex.: 96%", frequencia_cardiaca: "Ex.: 78 bpm", peso: "Ex.: 62 kg" };
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Registro "feito" de uma ocorrência (pede o valor nas aferições). */
export function RegistrarOcorrenciaDialog({ alvo, onClose, onFeito }: { alvo: Ocorrencia | null; onClose: () => void; onFeito: () => void }) {
  const { toast } = useToast();
  const [valor, setValor] = useState(""); const [obs, setObs] = useState(""); const [salvando, setSalvando] = useState(false);
  const r = alvo?.rotina;
  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("portal_rotina_executar" as any, { _id: r!.id, _chave: alvo!.chave, _valor: valor || null, _observacao: obs || null });
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" });
    toast({ title: "Registrado" }); setValor(""); setObs(""); onClose(); onFeito();
  };
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{r?.titulo}</DialogTitle><DialogDescription>{r?.residente_nome} · {alvo?.rotulo}</DialogDescription></DialogHeader>
        {r?.instrucoes && <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{r.instrucoes}</p>}
        {r && <ListaAnexos rotinaId={r.id} />}
        {r?.tipo === "afericao" && <div><Label>{AFERICOES[r.tipo_afericao ?? ""] ?? "Valor"}</Label><Input autoFocus maxLength={40} placeholder={PLACEHOLDER[r.tipo_afericao ?? ""] ?? "Valor"} value={valor} onChange={(e) => setValor(e.target.value)} /></div>}
        <div><Label>Observação (opcional)</Label><Textarea rows={2} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <DialogFooter><Button onClick={salvar} disabled={salvando || (r?.tipo === "afericao" && !valor.trim())}><CheckCircle2 className="mr-1 h-4 w-4" />Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Encerrar rotina antes do fim (motivo obrigatório; nada é apagado). */
export function EncerrarRotinaDialog({ rotina, onClose, onFeito }: { rotina: RotinaCuidado | null; onClose: () => void; onFeito: () => void }) {
  const { toast } = useToast(); const [motivo, setMotivo] = useState("");
  const salvar = async () => {
    const { error } = await supabase.rpc("portal_rotina_encerrar" as any, { _id: rotina!.id, _motivo: motivo });
    if (error) return toast({ title: "Não foi possível encerrar", description: error.message, variant: "destructive" });
    toast({ title: "Rotina encerrada" }); setMotivo(""); onClose(); onFeito();
  };
  return (
    <Dialog open={!!rotina} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Encerrar rotina</DialogTitle><DialogDescription>{rotina?.titulo} — {rotina?.residente_nome}</DialogDescription></DialogHeader>
        <Textarea placeholder="Motivo (obrigatório)" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <DialogFooter><Button variant="destructive" disabled={motivo.trim().length < 3} onClick={salvar}>Encerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CartaoRotina({ r, onEditar, onEncerrar }: { r: RotinaCuidado; onEditar: () => void; onEncerrar: () => void }) {
  return (
    <Card><CardContent className="space-y-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-semibold">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.residente_nome}</p></div>
        <Badge variant="outline">{TIPOS[r.tipo]}</Badge>
      </div>
      <p className="text-xs">{descreverFrequencia(r)} · {r.fim ? `até ${new Date(`${r.fim}T12:00:00`).toLocaleDateString("pt-BR")}` : "contínuo"}</p>
      {r.instrucoes && <p className="line-clamp-2 text-sm text-muted-foreground">{r.instrucoes}</p>}
      <ListaAnexos rotinaId={r.id} />
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onEditar}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
        <Button size="sm" variant="ghost" onClick={onEncerrar}><StopCircle className="mr-1 h-3.5 w-3.5" />Encerrar</Button>
      </div>
    </CardContent></Card>
  );
}

/** Rotinas do dia: procedimentos e aferições por horário, mais orientações fixas. */
export default function RotinasDia() {
  const { rotinas, ocorrencias, orientacoes, carregar } = useRotinasDia();
  const [alvo, setAlvo] = useState<Ocorrencia | null>(null);
  const [editar, setEditar] = useState<RotinaCuidado | null | undefined>(undefined);
  const [encerrar, setEncerrar] = useState<RotinaCuidado | null>(null);
  const [soPendentes, setSoPendentes] = useState(true);
  const lista = soPendentes ? ocorrencias.filter((o) => o.status !== "feito") : ocorrencias;

  return (
    <div className="container mx-auto px-3 py-5 sm:px-4">
      <TituloTarefa icone={ClipboardList} titulo="Rotinas" descricao="Procedimentos, aferições e orientações dos residentes"
        acao={<Button onClick={() => setEditar(null)}><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Nova rotina</span></Button>} />
      {rotinas === null ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Tabs defaultValue="hoje">
          <TabsList><TabsTrigger value="hoje">Hoje</TabsTrigger><TabsTrigger value="ativas">Ativas ({rotinas.length})</TabsTrigger></TabsList>
          <TabsContent value="hoje" className="space-y-4">
            {!!orientacoes.length && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Orientações</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {orientacoes.map((o) => (
                    <div key={o.id} className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div><p><b>{o.residente_nome}</b> · {MOMENTOS[o.momento ?? ""] ?? descreverFrequencia(o)}: {o.titulo}</p>{o.instrucoes && <p className="text-muted-foreground">{o.instrucoes}</p>}<div className="mt-1"><ListaAnexos rotinaId={o.id} /></div></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Para fazer hoje</h3>
              <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
                <button className={`rounded px-2 py-1 ${soPendentes ? "bg-background shadow" : ""}`} onClick={() => setSoPendentes(true)}>A fazer</button>
                <button className={`rounded px-2 py-1 ${!soPendentes ? "bg-background shadow" : ""}`} onClick={() => setSoPendentes(false)}>Todas</button>
              </div>
            </div>
            {!lista.length && <p className="text-sm text-muted-foreground">Nada pendente.</p>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((o) => (
                <Card key={`${o.rotina.id}${o.chave}`} className={COR[o.status]}>
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-center justify-between"><span className="font-semibold">{o.rotulo}</span><Badge variant={o.status === "atrasado" ? "destructive" : "secondary"}>{ROTULO[o.status]}</Badge></div>
                    <p className="text-sm font-medium">{o.rotina.titulo}</p>
                    <p className="text-xs text-muted-foreground">{o.rotina.residente_nome}</p>
                    {o.execucao ? <p className="text-xs">{o.execucao.valor ? <b>{o.execucao.valor} · </b> : null}{o.execucao.feito_por_nome} às {horaBR(o.execucao.feito_em)}</p>
                      : <Button size="sm" className="mt-1 w-full" onClick={() => setAlvo(o)}><CheckCircle2 className="mr-1 h-4 w-4" />{o.rotina.tipo === "afericao" ? "Registrar aferição" : "Feito"}</Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="ativas" className="grid gap-2 sm:grid-cols-2">
            {!rotinas.length && <p className="text-sm text-muted-foreground">Nenhuma rotina ativa.</p>}
            {rotinas.map((r) => <CartaoRotina key={r.id} r={r} onEditar={() => setEditar(r)} onEncerrar={() => setEncerrar(r)} />)}
          </TabsContent>
        </Tabs>
      )}
      <RegistrarOcorrenciaDialog alvo={alvo} onClose={() => setAlvo(null)} onFeito={carregar} />
      <RotinaDialog open={editar !== undefined} onOpenChange={(o) => !o && setEditar(undefined)} rotina={editar} onSalvo={carregar} />
      <EncerrarRotinaDialog rotina={encerrar} onClose={() => setEncerrar(null)} onFeito={carregar} />
    </div>
  );
}
