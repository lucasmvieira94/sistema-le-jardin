/**
 * Painel do Comitê de Apuração (papel Compliance). Todo acesso passa pela função
 * `denuncia-comite`, que descriptografa e grava a trilha de auditoria imutável.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldAlert, Paperclip, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIAS, CONCLUSOES, SITUACOES, agregarPorMes, nivelRisco, prazoVencido, proximasSituacoes,
  type Categoria, type Situacao,
} from "@/utils/canalDenuncias";
import { formatarData } from "@/utils/dateUtils";

type Item = { id: string; protocolo: string; anonima: boolean; categoria: Categoria; situacao: Situacao; conclusao: string | null; probabilidade: number | null; severidade: number | null; prazo_resposta: string; ainda_ocorre: boolean | null; created_at: string };
// deno-lint-ignore no-explicit-any
type Detalhe = { denuncia: any; mensagens: { id: string; autor: string; texto: string; em: string }[]; anexos: { id: string; nome: string; mime: string; tamanho: number; sha256: string; por: string; em: string }[]; auditoria: { usuario_nome: string | null; acao: string; detalhe: string; created_at: string }[] };

const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const COR_RISCO: Record<string, "destructive" | "default" | "secondary" | "outline"> = { critico: "destructive", alto: "destructive", moderado: "default", baixo: "secondary", nao_avaliado: "outline" };

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("denuncia-comite", { body });
  if (error || data?.error) {
    let m = data?.error;
    try { m = m || (await (error as { context?: Response })?.context?.json())?.error; } catch { /* ignore */ }
    throw new Error(m || "Falha na operação");
  }
  return data as T;
}

export default function CanalDenuncias() {
  const [lista, setLista] = useState<Item[] | null>(null);
  const [negado, setNegado] = useState(false);
  const [filtro, setFiltro] = useState({ situacao: "abertas", categoria: "todas", de: "", ate: "" });
  const [aberto, setAberto] = useState<Detalhe | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const [medidas, setMedidas] = useState("");

  const carregar = async () => {
    try { setLista((await chamar<{ denuncias: Item[] }>({ action: "listar" })).denuncias); }
    catch (e) { if ((e as Error).message.includes("restrito")) setNegado(true); else toast.error((e as Error).message); setLista([]); }
  };
  useEffect(() => { carregar(); }, []);

  const filtrada = useMemo(() => (lista ?? []).filter((d) => {
    const dia = new Date(d.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (filtro.situacao === "abertas" && ["concluida", "arquivada"].includes(d.situacao)) return false;
    if (!["abertas", "todas"].includes(filtro.situacao) && d.situacao !== filtro.situacao) return false;
    if (filtro.categoria !== "todas" && d.categoria !== filtro.categoria) return false;
    if (filtro.de && dia < filtro.de) return false;
    if (filtro.ate && dia > filtro.ate) return false;
    return true;
  }), [lista, filtro]);

  const abrir = async (id: string, body: Record<string, unknown> = { action: "detalhe", id }) => {
    setOcupado(true);
    try { const d = await chamar<Detalhe>(body); setAberto(d); setMedidas(d.denuncia.medidas ?? ""); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };
  const atualizar = async (campos: Record<string, unknown>) => { if (aberto) { await abrir(aberto.denuncia.id, { action: "atualizar", id: aberto.denuncia.id, ...campos }); carregar(); } };
  const enviarMsg = async () => { if (aberto && texto.trim()) { await abrir(aberto.denuncia.id, { action: "mensagem", id: aberto.denuncia.id, texto, interna }); setTexto(""); } };
  const verAnexo = async (id: string) => {
    try {
      const a = await chamar<{ nome: string; mime: string; base64: string }>({ action: "anexo", id });
      const bin = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
      window.open(URL.createObjectURL(new Blob([bin], { type: a.mime })), "_blank");
    } catch (e) { toast.error((e as Error).message); }
  };

  if (negado) return (
    <div className="p-6"><Card><CardContent className="pt-6 flex items-center gap-3"><Lock className="w-5 h-5" />Acesso restrito ao comitê de apuração. Peça a um administrador para designá-lo em Configurações.</CardContent></Card></div>
  );

  const d = aberto?.denuncia;
  const risco = nivelRisco(d?.probabilidade, d?.severidade);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold">Canal de Denúncias</h1></div>
      <p className="text-sm text-muted-foreground">Endereço público para divulgar aos colaboradores: <b>{window.location.origin}/denuncia</b>. Cada acesso seu fica registrado na trilha de auditoria.</p>

      <Tabs defaultValue="casos">
        <TabsList><TabsTrigger value="casos">Casos</TabsTrigger><TabsTrigger value="relatorio">Relatório NR-01</TabsTrigger></TabsList>
        <TabsContent value="casos" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={filtro.situacao} onValueChange={(v) => setFiltro({ ...filtro, situacao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="abertas">Em aberto</SelectItem><SelectItem value="todas">Todas</SelectItem>{Object.entries(SITUACOES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filtro.categoria} onValueChange={(v) => setFiltro({ ...filtro, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{Object.entries(CATEGORIAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} aria-label="De" />
            <Input type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} aria-label="Até" />
          </div>
          {lista === null ? <Loader2 className="animate-spin" /> : filtrada.length === 0 ? <p className="text-muted-foreground">Nenhuma denúncia encontrada.</p> : (
            <div className="space-y-2">
              {filtrada.map((x) => {
                const r = nivelRisco(x.probabilidade, x.severidade);
                const vencido = prazoVencido(x.prazo_resposta, x.situacao, hoje());
                return (
                  <button key={x.id} onClick={() => abrir(x.id)} className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 flex flex-wrap items-center gap-2 justify-between">
                    <div><p className="font-mono font-semibold">{x.protocolo}</p><p className="text-sm text-muted-foreground">{CATEGORIAS[x.categoria]} · {dataHora(x.created_at)} · {x.anonima ? "Anônima" : "Identificada"}</p></div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={COR_RISCO[r.nivel]}>Risco {r.nivel === "nao_avaliado" ? "não avaliado" : r.nivel}</Badge>
                      <Badge variant="outline">{SITUACOES[x.situacao]}</Badge>
                      {vencido && <Badge variant="destructive">Prazo vencido</Badge>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="relatorio">
          <Card><CardHeader><CardTitle className="text-base">Ocorrências por mês e categoria (sem dados identificáveis) — para o inventário de riscos psicossociais do PGR</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Mês</th>{Object.values(CATEGORIAS).map((c) => <th key={c} className="px-2">{c}</th>)}<th>Total</th></tr></thead>
                <tbody>{agregarPorMes(lista ?? []).map((m) => (
                  <tr key={m.mes} className="border-b"><td className="py-2">{m.mes.split("-").reverse().join("/")}</td>{Object.keys(CATEGORIAS).map((c) => <td key={c} className="px-2">{m.porCategoria[c] ?? 0}</td>)}<td className="font-semibold">{m.total}</td></tr>
                ))}</tbody></table>
            </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {d && (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2 flex-wrap"><span className="font-mono">{d.protocolo}</span><Badge variant="outline">{SITUACOES[d.situacao as Situacao]}</Badge>{ocupado && <Loader2 className="w-4 h-4 animate-spin" />}</DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <p><b>Tipo:</b> {CATEGORIAS[d.categoria as Categoria]}</p>
              <p><b>Recebida:</b> {dataHora(d.created_at)}</p>
              <p><b>Prazo:</b> {formatarData(d.prazo_resposta)}</p>
              <p><b>Ainda ocorre:</b> {d.ainda_ocorre == null ? "Não informado" : d.ainda_ocorre ? "Sim" : "Não"}</p>
              <p><b>Quando:</b> {d.quando || "—"}</p><p><b>Local:</b> {d.local || "—"}</p>
              <p className="sm:col-span-2"><b>Denunciante:</b> {d.identificacao ? `${d.identificacao.nome ?? ""} ${d.identificacao.contato ? `(${d.identificacao.contato})` : ""}` : "Anônimo"}</p>
              <p className="sm:col-span-2"><b>Envolvidos:</b> {d.envolvidos || "—"}</p>
              <p className="sm:col-span-2"><b>Testemunhas:</b> {d.testemunhas || "—"}</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{d.relato}</div>
            {aberto!.anexos.length > 0 && <div className="space-y-1">{aberto!.anexos.map((a) => (
              <button key={a.id} onClick={() => verAnexo(a.id)} className="flex items-center gap-2 text-sm text-primary underline"><Paperclip className="w-3 h-3" />{a.nome} ({Math.round(a.tamanho / 1024)} KB · {dataHora(a.em)})</button>
            ))}</div>}

            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Apuração e classificação de risco (GRO / NR-01)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><Label>Situação</Label>
                    <Select value={d.situacao} onValueChange={(v) => atualizar({ situacao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value={d.situacao}>{SITUACOES[d.situacao as Situacao]}</SelectItem>{proximasSituacoes(d.situacao).map((s) => <SelectItem key={s} value={s}>{SITUACOES[s]}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label>Conclusão</Label>
                    <Select value={d.conclusao ?? ""} onValueChange={(v) => atualizar({ conclusao: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{Object.entries(CONCLUSOES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select></div>
                  {(["probabilidade", "severidade"] as const).map((c) => (
                    <div key={c}><Label className="capitalize">{c} (1-5)</Label>
                      <Select value={d[c] ? String(d[c]) : ""} onValueChange={(v) => atualizar({ [c]: Number(v) })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select></div>
                  ))}
                </div>
                <Badge variant={COR_RISCO[risco.nivel]}>Nível de risco: {risco.nivel === "nao_avaliado" ? "não avaliado" : `${risco.nivel} (${risco.pontos})`}</Badge>
                <div><Label>Medidas adotadas (plano de ação)</Label><Textarea rows={3} maxLength={4000} value={medidas} onChange={(e) => setMedidas(e.target.value)} />
                  <Button size="sm" className="mt-2" variant="outline" disabled={medidas === (d.medidas ?? "")} onClick={() => atualizar({ medidas })}>Salvar medidas</Button></div>
              </CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Mensagens</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {aberto!.mensagens.map((m) => (
                  <div key={m.id} className={`rounded p-2 text-sm ${m.autor === "interna" ? "border border-dashed" : m.autor === "comite" ? "bg-primary/10" : "bg-muted"}`}>
                    <p className="text-xs text-muted-foreground">{m.autor === "interna" ? "Anotação interna (o denunciante não vê)" : m.autor === "comite" ? "Comitê" : "Denunciante"} · {dataHora(m.em)}</p>
                    <p className="whitespace-pre-wrap">{m.texto}</p>
                  </div>
                ))}
                <Textarea rows={3} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={interna ? "Anotação interna" : "Pergunta ou retorno ao denunciante"} />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={interna} onCheckedChange={setInterna} />Anotação interna</label>
                  <Button size="sm" onClick={enviarMsg} disabled={!texto.trim() || ocupado}>Enviar</Button>
                </div>
              </CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-base">Trilha de auditoria</CardTitle></CardHeader>
              <CardContent className="space-y-1 max-h-48 overflow-y-auto text-xs">
                {aberto!.auditoria.map((a, i) => <p key={i}><b>{a.usuario_nome ?? "Denunciante"}</b> — {a.detalhe} em {dataHora(a.created_at)}</p>)}
              </CardContent></Card>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
