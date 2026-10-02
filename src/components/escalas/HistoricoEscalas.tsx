/**
 * Histórico de escalas do funcionário: linha do tempo dos períodos, troca de
 * escala a partir de uma data, lançamento de período antigo, correção e exclusão
 * (com justificativa). Todas as ações passam por funções do banco que validam
 * permissão de administrador, impedem sobreposição e registram auditoria.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, History, Pencil, Plus, Trash2 } from "lucide-react";
import { formatarData, hojeISO } from "@/utils/dateUtils";
import {
  ordenarHistorico,
  validarPeriodo,
  validarTrocaEscala,
  type PeriodoEscala,
} from "@/utils/escalaVigente";

interface EscalaResumo { id: number; nome: string; jornada_trabalho: string; entrada: string | null; saida: string | null }
type Periodo = PeriodoEscala<EscalaResumo> & { id: string; created_at?: string };
type Modo = "trocar" | "lancar" | "corrigir" | "excluir";

export default function HistoricoEscalas({ funcionarioId, onAlterado }: { funcionarioId: string; onAlterado?: () => void }) {
  const { toast } = useToast();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [escalas, setEscalas] = useState<EscalaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<Modo | null>(null);
  const [alvo, setAlvo] = useState<Periodo | null>(null);
  const [form, setForm] = useState({ escala_id: "", data_inicio: hojeISO(), data_fim: "", texto: "" });
  const [salvando, setSalvando] = useState(false);
  const db = supabase as any;

  const carregar = useCallback(async () => {
    setLoading(true);
    const [h, e] = await Promise.all([
      db.from("funcionarios_escalas_historico")
        .select("id, funcionario_id, escala_id, data_inicio, data_fim, motivo, created_at, escala:escala_id(id, nome, jornada_trabalho, entrada, saida)")
        .eq("funcionario_id", funcionarioId),
      db.from("escalas").select("id, nome, jornada_trabalho, entrada, saida").order("nome"),
    ]);
    if (h.error) toast({ title: "Erro ao carregar histórico", description: h.error.message, variant: "destructive" });
    setPeriodos(ordenarHistorico(h.data || []) as Periodo[]);
    setEscalas(e.data || []);
    setLoading(false);
  }, [funcionarioId]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (m: Modo, p: Periodo | null = null) => {
    setModo(m);
    setAlvo(p);
    setForm({
      escala_id: p ? String(p.escala_id) : "",
      data_inicio: p?.data_inicio ?? hojeISO(),
      data_fim: p?.data_fim ?? "",
      texto: "",
    });
  };

  const salvar = async () => {
    const escalaId = Number(form.escala_id);
    let erro: string | null = null;
    if (modo === "trocar") erro = validarTrocaEscala(periodos, escalaId, form.data_inicio);
    if (modo === "lancar") erro = !form.data_fim ? "Informe a data de fim do período antigo." : validarPeriodo(periodos, { data_inicio: form.data_inicio, data_fim: form.data_fim });
    if (modo === "corrigir") erro = validarPeriodo(periodos, { id: alvo!.id, data_inicio: form.data_inicio, data_fim: form.data_fim || null });
    if ((modo === "lancar" || modo === "corrigir" || modo === "excluir") && !form.texto.trim()) erro = erro ?? "Informe o motivo/justificativa.";
    if (modo !== "excluir" && !escalaId) erro = erro ?? "Selecione a escala.";
    if (erro) { toast({ title: "Verifique os dados", description: erro, variant: "destructive" }); return; }

    setSalvando(true);
    const chamadas = {
      trocar: () => db.rpc("alterar_escala_funcionario", { p_funcionario_id: funcionarioId, p_escala_id: escalaId, p_data_inicio: form.data_inicio, p_motivo: form.texto }),
      lancar: () => db.rpc("lancar_periodo_escala", { p_funcionario_id: funcionarioId, p_escala_id: escalaId, p_data_inicio: form.data_inicio, p_data_fim: form.data_fim, p_motivo: form.texto }),
      corrigir: () => db.rpc("corrigir_periodo_escala", { p_id: alvo!.id, p_escala_id: escalaId, p_data_inicio: form.data_inicio, p_data_fim: form.data_fim || null, p_justificativa: form.texto }),
      excluir: () => db.rpc("excluir_periodo_escala", { p_id: alvo!.id, p_justificativa: form.texto }),
    } as const;
    const { error } = await chamadas[modo!]();
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: modo === "trocar" ? "Escala alterada" : "Histórico atualizado" });
    setModo(null);
    await carregar();
    onAlterado?.();
  };

  const hoje = hojeISO();
  const titulos: Record<Modo, string> = {
    trocar: "Alterar escala",
    lancar: "Lançar período antigo",
    corrigir: "Corrigir período",
    excluir: "Excluir período",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-primary" />Histórico de escalas</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => abrir("lancar")}><Plus className="w-4 h-4 mr-1" />Período antigo</Button>
            <Button size="sm" onClick={() => abrir("trocar")}><CalendarClock className="w-4 h-4 mr-1" />Alterar escala</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada dia é calculado pela escala que estava em vigor naquele dia. Alterar a escala não muda os dias anteriores.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : periodos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma escala registrada.</p>
        ) : periodos.map((p) => {
          const vigente = p.data_inicio <= hoje && (p.data_fim === null || p.data_fim >= hoje);
          const futura = p.data_inicio > hoje;
          return (
            <div key={p.id} className="flex items-start justify-between gap-2 border rounded-lg p-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{p.escala?.nome ?? `Escala ${p.escala_id}`}</span>
                  {vigente && <Badge className="text-xs">Em vigor</Badge>}
                  {futura && <Badge variant="secondary" className="text-xs">Programada</Badge>}
                  {!vigente && !futura && <Badge variant="outline" className="text-xs">Encerrada</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatarData(p.data_inicio)} até {p.data_fim ? formatarData(p.data_fim) : "o momento"}
                  {p.escala ? ` · ${p.escala.jornada_trabalho} · ${p.escala.entrada?.slice(0, 5) ?? "--"} às ${p.escala.saida?.slice(0, 5) ?? "--"}` : ""}
                </p>
                {p.motivo && <p className="text-xs text-muted-foreground">Motivo: {p.motivo}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Corrigir período" onClick={() => abrir("corrigir", p)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Excluir período" onClick={() => abrir("excluir", p)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!modo} onOpenChange={(o) => !o && setModo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modo && titulos[modo]}</DialogTitle>
            <DialogDescription>
              {modo === "trocar" && "A nova escala vale a partir da data informada. O período anterior é encerrado no dia anterior."}
              {modo === "lancar" && "Registre uma escala em que o funcionário trabalhou no passado. O período não pode se sobrepor a outro."}
              {modo === "corrigir" && "Corrija a escala ou as datas deste período. A alteração fica registrada na auditoria."}
              {modo === "excluir" && "Se este for o período em vigor, o período anterior volta a valer. A exclusão fica registrada na auditoria."}
            </DialogDescription>
          </DialogHeader>
          {modo !== "excluir" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Escala</Label>
                <Select value={form.escala_id} onValueChange={(v) => setForm({ ...form, escala_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a escala" /></SelectTrigger>
                  <SelectContent>
                    {escalas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome} ({e.jornada_trabalho})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Início</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                {modo !== "trocar" && (
                  <div className="space-y-1">
                    <Label>Fim {modo === "corrigir" && "(vazio = em vigor)"}</Label>
                    <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>{modo === "trocar" ? "Motivo (opcional)" : modo === "lancar" ? "Motivo" : "Justificativa"}</Label>
            <Textarea value={form.texto} maxLength={500} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModo(null)}>Cancelar</Button>
            <Button variant={modo === "excluir" ? "destructive" : "default"} disabled={salvando} onClick={salvar}>
              {modo === "excluir" ? "Excluir" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
