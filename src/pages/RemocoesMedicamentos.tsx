import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Pedido = { id: string; residente: string; medicamento: string; quantidade: number | null; motivo: string; solicitante: string | null;
  status: string; created_at: string; revisado_em: string | null; observacao_gestor: string | null };

const dataHora = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Gestor aprova (remove de vez) ou recusa (devolve ao estoque) os pedidos de remoção feitos pelas cuidadoras. */
function CartaoPedido({ p, reload }: { p: Pedido; reload: () => void }) {
  const [obs, setObs] = useState(""), [busy, setBusy] = useState(false);
  async function decidir(aprovar: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("gestor_revisar_remocao_estoque" as any, { p_id: p.id, p_aprovar: aprovar, p_observacao: obs || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(aprovar ? "Remoção aprovada." : "Remoção recusada: o remédio voltou ao estoque.");
    reload();
  }
  return (
    <article className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">{p.medicamento} · {p.residente}</p>
        <span className="text-xs text-muted-foreground">{dataHora(p.created_at)}</span>
      </div>
      <p className="text-xs text-muted-foreground">Pedido por {p.solicitante ?? "—"} · Quantidade no estoque: {Number(p.quantidade ?? 0)}</p>
      <p className="whitespace-pre-wrap text-sm"><strong>Justificativa:</strong> {p.motivo}</p>
      {p.status === "pendente" ? (<>
        <Textarea aria-label="Observação do gestor" placeholder="Observação (opcional)" value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void decidir(true)}>Aprovar remoção</Button>
          <Button variant="outline" disabled={busy} onClick={() => void decidir(false)}>Recusar e devolver ao estoque</Button>
        </div>
      </>) : (
        <p className="text-xs text-muted-foreground">{p.status === "aprovada" ? "Aprovada" : "Recusada"}{p.revisado_em ? ` em ${dataHora(p.revisado_em)}` : ""}{p.observacao_gestor ? ` · ${p.observacao_gestor}` : ""}</p>
      )}
    </article>
  );
}

function ListaMedicamentos() {
  const [status, setStatus] = useState("pendente"), [itens, setItens] = useState<Pedido[]>([]), [erro, setErro] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("gestor_remocoes_estoque" as any, { p_status: status });
    if (error) setErro("Não foi possível consultar os pedidos."); else { setErro(""); setItens((data as Pedido[]) ?? []); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">Pedidos para tirar remédios do estoque. Enquanto aguardam, os remédios ficam fora do estoque.</p>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="pendente">Aguardando decisão</SelectItem><SelectItem value="aprovada">Aprovadas</SelectItem><SelectItem value="rejeitada">Recusadas</SelectItem></SelectContent>
      </Select>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      {!erro && !itens.length && <p className="text-sm text-muted-foreground">Nenhum pedido nesta situação.</p>}
      {itens.map((p) => <CartaoPedido key={p.id} p={p} reload={() => void load()} />)}
    </section>
  );
}

type PedidoObs = { id: string; residente: string; texto: string; valida_ate: string | null; autor: string | null; motivo: string | null;
  solicitante: string | null; status: string; solicitado_em: string; revisado_em: string | null; observacao_gestor: string | null };

/** Pedidos de exclusão de observações: aprovar remove; recusar devolve à ficha. */
function CartaoObs({ p, reload }: { p: PedidoObs; reload: () => void }) {
  const [obs, setObs] = useState(""), [busy, setBusy] = useState(false);
  async function decidir(aprovar: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("gestor_revisar_remocao_observacao" as any, { p_id: p.id, p_aprovar: aprovar, p_observacao: obs || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(aprovar ? "Exclusão aprovada." : "Exclusão recusada: a observação voltou à ficha.");
    reload();
  }
  return (
    <article className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">{p.residente}</p>
        <span className="text-xs text-muted-foreground">{dataHora(p.solicitado_em)}</span>
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-muted p-2 text-sm">{p.texto}</p>
      <p className="text-xs text-muted-foreground">Escrita por {p.autor ?? "—"} · Exclusão pedida por {p.solicitante ?? "—"}</p>
      <p className="whitespace-pre-wrap text-sm"><strong>Justificativa:</strong> {p.motivo}</p>
      {p.status === "pendente" ? (<>
        <Textarea aria-label="Observação do gestor" placeholder="Observação (opcional)" value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void decidir(true)}>Aprovar exclusão</Button>
          <Button variant="outline" disabled={busy} onClick={() => void decidir(false)}>Recusar e devolver à ficha</Button>
        </div>
      </>) : (
        <p className="text-xs text-muted-foreground">{p.status === "aprovada" ? "Aprovada" : "Recusada"}{p.revisado_em ? ` em ${dataHora(p.revisado_em)}` : ""}{p.observacao_gestor ? ` · ${p.observacao_gestor}` : ""}</p>
      )}
    </article>
  );
}

function ListaObservacoes() {
  const [status, setStatus] = useState("pendente"), [itens, setItens] = useState<PedidoObs[]>([]), [erro, setErro] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("gestor_observacoes_remocao" as any, { p_status: status });
    if (error) setErro("Não foi possível consultar os pedidos."); else { setErro(""); setItens((data as PedidoObs[]) ?? []); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">Pedidos das cuidadoras para excluir observações. Enquanto aguardam, as observações ficam fora da ficha.</p>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="pendente">Aguardando decisão</SelectItem><SelectItem value="aprovada">Aprovadas</SelectItem><SelectItem value="rejeitada">Recusadas</SelectItem></SelectContent>
      </Select>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      {!erro && !itens.length && <p className="text-sm text-muted-foreground">Nenhum pedido nesta situação.</p>}
      {itens.map((p) => <CartaoObs key={p.id} p={p} reload={() => void load()} />)}
    </section>
  );
}

export default function RemocoesMedicamentos() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Aprovações de remoção</h1>
      <Tabs defaultValue="medicamentos">
        <TabsList><TabsTrigger value="medicamentos">Medicamentos</TabsTrigger><TabsTrigger value="observacoes">Observações</TabsTrigger></TabsList>
        <TabsContent value="medicamentos"><ListaMedicamentos /></TabsContent>
        <TabsContent value="observacoes"><ListaObservacoes /></TabsContent>
      </Tabs>
    </main>
  );
}
