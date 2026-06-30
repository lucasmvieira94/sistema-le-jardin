import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Loader2, CreditCard, AlertCircle, Repeat, Pencil, Ban, FileText } from "lucide-react";
import { formatarData } from "@/utils/dateUtils";
import { CATEGORIAS, useContasPagar, type ContaPagar } from "@/hooks/financeiro/useContasPagar";
import ContaPagarForm from "./ContaPagarForm";
import BaixaPagamentoDialog from "./BaixaPagamentoDialog";
import EmitirReciboDespesaDialog from "./EmitirReciboDespesaDialog";
import { useToast } from "@/hooks/use-toast";

const fmtBRL = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  pago: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  atrasado: "bg-red-500/15 text-red-700 border-red-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const labelCat = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;

export default function ContasPagarLista() {
  const { toast } = useToast();
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [inicio, setInicio] = useState(inicioMes);
  const [fim, setFim] = useState(fimMes);
  const [status, setStatus] = useState<any>("todos");
  const [categoria, setCategoria] = useState<any>("todas");

  const { contas, loading, recarregar } = useContasPagar({ inicio, fim, status, categoria });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContaPagar | null>(null);
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaConta, setBaixaConta] = useState<ContaPagar | null>(null);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [reciboConta, setReciboConta] = useState<ContaPagar | null>(null);

  const totais = useMemo(() => {
    const ativas = contas.filter((c) => c.status !== "cancelado");
    const totalGeral = ativas.reduce((s, c) => s + Number(c.valor), 0);
    const pagas = ativas.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor), 0);
    const aPagar = ativas.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);
    const atrasadas = ativas.filter((c) => c.status === "atrasado").reduce((s, c) => s + Number(c.valor), 0);
    return { totalGeral, pagas, aPagar, atrasadas, qtdAtrasadas: ativas.filter((c) => c.status === "atrasado").length };
  }, [contas]);

  const cancelar = async (c: ContaPagar) => {
    if (!confirm(`Cancelar a conta "${c.descricao}"?`)) return;
    const { error } = await (supabase as any).from("contas_pagar").update({ status: "cancelado" }).eq("id", c.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    recarregar();
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total no período</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{fmtBRL(totais.totalGeral)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pagas</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-emerald-700">{fmtBRL(totais.pagas)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">A Pagar</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-yellow-700">{fmtBRL(totais.aPagar)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Atrasadas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-700">{fmtBRL(totais.atrasadas)}</div>
            <div className="text-xs text-muted-foreground">{totais.qtdAtrasadas} conta(s)</div>
          </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>Contas a Pagar</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={recarregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : contas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhuma conta cadastrada no período. Clique em "Nova conta" para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {c.descricao}
                          {c.recorrente && <Repeat className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell>{labelCat(c.categoria)}</TableCell>
                      <TableCell>{c.fornecedor ?? "—"}</TableCell>
                      <TableCell>
                        {formatarData(c.data_vencimento)}
                        {c.status === "atrasado" && <AlertCircle className="inline h-3.5 w-3.5 ml-1 text-red-600" />}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(Number(c.valor))}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[c.status]}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {c.status !== "pago" && c.status !== "cancelado" && (
                          <Button size="sm" onClick={() => { setBaixaConta(c); setBaixaOpen(true); }}>
                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Pagar
                          </Button>
                        )}
                        {c.status !== "pago" && (
                          <Button size="sm" variant="outline" onClick={() => { setEditing(c); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {c.status !== "pago" && c.status !== "cancelado" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelar(c)} title="Cancelar">
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {c.status === "pago" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReciboConta(c); setReciboOpen(true); }}
                            title="Emitir recibo de pagamento"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" /> Recibo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ContaPagarForm open={formOpen} onOpenChange={setFormOpen} conta={editing} onSaved={recarregar} />
      <BaixaPagamentoDialog open={baixaOpen} onOpenChange={setBaixaOpen} conta={baixaConta} onSaved={recarregar} />
      <EmitirReciboDespesaDialog open={reciboOpen} onOpenChange={setReciboOpen} conta={reciboConta} onSaved={recarregar} />
    </div>
  );
}
