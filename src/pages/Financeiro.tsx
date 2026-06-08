import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, AlertCircle, Plus, RefreshCw, Wallet, Loader2, Receipt } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import ContasPagarLista from "@/components/financeiro/ContasPagarLista";
import LucratividadeDashboard from "@/components/financeiro/LucratividadeDashboard";
import { formatarData } from "@/utils/dateUtils";
import { gerarReciboPDF } from "@/utils/reciboPDF";

type Mensalidade = {
  id: string;
  residente_id: string;
  competencia: string;
  data_vencimento: string;
  valor_mensalidade: number;
  valor_extras: number;
  valor_desconto: number;
  valor_total: number;
  valor_pago: number;
  status: "pendente" | "pago" | "parcial" | "vencido" | "cancelado";
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
};

type Residente = { id: string; nome_completo: string; numero_prontuario: string | null };

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  pago: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  parcial: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  vencido: "bg-red-500/15 text-red-700 border-red-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const competenciaAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function Financeiro() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "contas-pagar" || tabParam === "lucratividade" ? tabParam : "receitas";
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    const cur = searchParams.get("tab");
    if (cur !== tab) {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", tab);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [competencia, setCompetencia] = useState<string>(competenciaAtual());
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Dialog: registrar pagamento
  const [pagDialog, setPagDialog] = useState<{ open: boolean; m: Mensalidade | null }>({ open: false, m: null });
  const [pagValor, setPagValor] = useState("");
  const [pagForma, setPagForma] = useState<"pix" | "boleto" | "dinheiro">("pix");
  const [pagData, setPagData] = useState(new Date().toISOString().slice(0, 10));
  const [pagObs, setPagObs] = useState("");

  // Dialog: nova cobrança manual
  const [novaDialog, setNovaDialog] = useState(false);
  const [novaResidente, setNovaResidente] = useState("");
  const [novaValor, setNovaValor] = useState("");
  const [novaVenc, setNovaVenc] = useState("");
  const [novaObs, setNovaObs] = useState("");

  // Dialog: lançamento extra
  const [extraDialog, setExtraDialog] = useState<{ open: boolean; m: Mensalidade | null }>({ open: false, m: null });
  const [extraDesc, setExtraDesc] = useState("");
  const [extraValor, setExtraValor] = useState("");
  const [extraTipo, setExtraTipo] = useState<"extra" | "desconto" | "servico_terceiros" | "adicional_natalino">("extra");

  const carregar = async () => {
    setLoading(true);
    const [mensRes, resiRes] = await Promise.all([
      (supabase as any)
        .from("mensalidades_residentes")
        .select("*")
        .eq("competencia", competencia)
        .order("data_vencimento", { ascending: true }),
      supabase
        .from("residentes")
        .select("id, nome_completo, numero_prontuario")
        .eq("ativo", true)
        .order("nome_completo"),
    ]);
    if (mensRes.error) toast({ title: "Erro ao carregar mensalidades", description: mensRes.error.message, variant: "destructive" });
    setMensalidades((mensRes.data as any) ?? []);
    setResidentes((resiRes.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [competencia]);

  const residenteNome = (id: string) =>
    residentes.find((r) => r.id === id)?.nome_completo ?? "—";

  const filtradas = useMemo(
    () => filtroStatus === "todos" ? mensalidades : mensalidades.filter((m) => m.status === filtroStatus),
    [mensalidades, filtroStatus]
  );

  const kpis = useMemo(() => {
    // Cobranças canceladas são excluídas do faturamento.
    const ativas = mensalidades.filter((m) => m.status !== "cancelado");
    const total = ativas.reduce((s, m) => s + Number(m.valor_total), 0);
    const recebido = ativas.reduce((s, m) => s + Number(m.valor_pago), 0);
    const aReceber = ativas
      .filter((m) => ["pendente", "parcial"].includes(m.status))
      .reduce((s, m) => s + (Number(m.valor_total) - Number(m.valor_pago)), 0);
    const vencido = ativas
      .filter((m) => m.status === "vencido")
      .reduce((s, m) => s + (Number(m.valor_total) - Number(m.valor_pago)), 0);
    const inadimplentes = ativas.filter((m) => m.status === "vencido").length;
    return { total, recebido, aReceber, vencido, inadimplentes };
  }, [mensalidades]);

  const gerarMensalidades = async () => {
    setGerando(true);
    const { data, error } = await (supabase as any).rpc("gerar_mensalidades_mes", {
      p_competencia: competencia,
    });
    setGerando(false);
    if (error) {
      toast({ title: "Erro ao gerar", description: error.message, variant: "destructive" });
      return;
    }
    const r = Array.isArray(data) ? data[0] : data;
    toast({
      title: "Mensalidades geradas",
      description: `Criadas: ${r?.criadas ?? 0} • Já existentes: ${r?.ja_existentes ?? 0}`,
    });
    carregar();
  };

  const abrirPagamento = (m: Mensalidade) => {
    const pendente = Number(m.valor_total) - Number(m.valor_pago);
    setPagValor(pendente.toFixed(2));
    setPagForma("pix");
    setPagData(new Date().toISOString().slice(0, 10));
    setPagObs(m.observacoes ?? "");
    setPagDialog({ open: true, m });
  };

  const registrarPagamento = async () => {
    if (!pagDialog.m) return;
    const valorRecebido = Number(pagValor || 0);
    const novoPago = Number(pagDialog.m.valor_pago) + valorRecebido;
    const { error } = await (supabase as any)
      .from("mensalidades_residentes")
      .update({
        valor_pago: novoPago,
        forma_pagamento: pagForma,
        data_pagamento: pagData,
        observacoes: pagObs || null,
      })
      .eq("id", pagDialog.m.id);
    if (error) {
      toast({ title: "Erro ao registrar pagamento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado", description: "Gerando recibo em PDF..." });
    // Recibo desse pagamento
    try {
      await gerarReciboPDF({
        residenteNome: residenteNome(pagDialog.m.residente_id),
        residenteId: pagDialog.m.residente_id,
        mensalidadeId: pagDialog.m.id,
        competencia: pagDialog.m.competencia,
        dataVencimento: pagDialog.m.data_vencimento,
        dataPagamento: pagData,
        valorMensalidade: Number(pagDialog.m.valor_mensalidade),
        valorExtras: Number(pagDialog.m.valor_extras),
        valorDesconto: Number(pagDialog.m.valor_desconto),
        valorTotal: Number(pagDialog.m.valor_total),
        valorPago: valorRecebido,
        formaPagamento: pagForma,
        numeroRecibo: `${pagDialog.m.id.slice(0, 8).toUpperCase()}-${pagData.replace(/-/g, "")}`,
        observacoes: pagObs,
      });
    } catch (e: any) {
      toast({ title: "Falha ao gerar recibo", description: e?.message ?? String(e), variant: "destructive" });
    }
    setPagDialog({ open: false, m: null });
    carregar();
  };

  const baixarReciboMensalidade = async (m: Mensalidade) => {
    try {
      await gerarReciboPDF({
        residenteNome: residenteNome(m.residente_id),
        residenteId: m.residente_id,
        mensalidadeId: m.id,
        competencia: m.competencia,
        dataVencimento: m.data_vencimento,
        dataPagamento: m.data_pagamento ?? new Date().toISOString().slice(0, 10),
        valorMensalidade: Number(m.valor_mensalidade),
        valorExtras: Number(m.valor_extras),
        valorDesconto: Number(m.valor_desconto),
        valorTotal: Number(m.valor_total),
        valorPago: Number(m.valor_pago),
        formaPagamento: m.forma_pagamento,
        numeroRecibo: `${m.id.slice(0, 8).toUpperCase()}-${(m.data_pagamento ?? "").replace(/-/g, "")}`,
        observacoes: m.observacoes,
      });
    } catch (e: any) {
      toast({ title: "Falha ao gerar recibo", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const cancelarMensalidade = async (m: Mensalidade) => {
    if (!confirm(`Cancelar a mensalidade de ${residenteNome(m.residente_id)}?`)) return;
    const { error } = await (supabase as any)
      .from("mensalidades_residentes")
      .update({ status: "cancelado" })
      .eq("id", m.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    carregar();
  };

  const criarManual = async () => {
    if (!novaResidente || !novaValor || !novaVenc) {
      toast({ title: "Preencha residente, valor e vencimento", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any)
      .from("mensalidades_residentes")
      .insert({
        residente_id: novaResidente,
        competencia,
        data_vencimento: novaVenc,
        valor_mensalidade: Number(novaValor),
        observacoes: novaObs || null,
        gerado_automaticamente: false,
      });
    if (error) {
      toast({ title: "Erro ao criar cobrança", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cobrança criada" });
    setNovaDialog(false);
    setNovaResidente(""); setNovaValor(""); setNovaVenc(""); setNovaObs("");
    carregar();
  };

  const salvarLancamento = async () => {
    if (!extraDialog.m || !extraDesc || !extraValor) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any)
      .from("lancamentos_financeiros")
      .insert({
        residente_id: extraDialog.m.residente_id,
        mensalidade_id: extraDialog.m.id,
        descricao: extraDesc,
        valor: Number(extraValor),
        tipo: extraTipo,
        competencia: extraDialog.m.competencia,
      });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lançamento adicionado" });
    setExtraDialog({ open: false, m: null });
    setExtraDesc(""); setExtraValor(""); setExtraTipo("extra");
    carregar();
  };

  const competenciaLabel = (() => {
    const [y, m] = competencia.split("-");
    return `${m}/${y}`;
  })();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="contas-pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="lucratividade">Lucratividade</TabsTrigger>
        </TabsList>

        <TabsContent value="receitas" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Financeiro · Mensalidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle de cobranças, pagamentos e inadimplência dos residentes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={competencia.slice(0, 7)}
            onChange={(e) => setCompetencia(`${e.target.value}-01`)}
            className="w-40"
          />
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={gerarMensalidades} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Gerar mensalidades do mês
          </Button>
          <Dialog open={novaDialog} onOpenChange={setNovaDialog}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Plus className="h-4 w-4 mr-1" />Cobrança manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova cobrança manual</DialogTitle>
                <DialogDescription>Competência: {competenciaLabel}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Residente</Label>
                  <Select value={novaResidente} onValueChange={setNovaResidente}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {residentes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={novaValor} onChange={(e) => setNovaValor(e.target.value)} />
                  </div>
                  <div>
                    <Label>Vencimento</Label>
                    <Input type="date" value={novaVenc} onChange={(e) => setNovaVenc(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={novaObs} onChange={(e) => setNovaObs(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovaDialog(false)}>Cancelar</Button>
                <Button onClick={criarManual}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Faturado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold">{fmtBRL(kpis.total)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-emerald-700">{fmtBRL(kpis.recebido)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Receipt className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-blue-700">{fmtBRL(kpis.aReceber)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-700">{fmtBRL(kpis.vencido)}</div>
            <div className="text-xs text-muted-foreground">{kpis.inadimplentes} inadimplente(s)</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + Tabela */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Cobranças · {competenciaLabel}</CardTitle>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhuma cobrança nesta competência. Use "Gerar mensalidades do mês" para criar a partir dos contratos ativos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Residente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                    <TableHead className="text-right">Extras</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{residenteNome(m.residente_id)}</TableCell>
                      <TableCell>{formatarData(m.data_vencimento)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(m.valor_mensalidade))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(m.valor_extras))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(m.valor_desconto))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(Number(m.valor_total))}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(m.valor_pago))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[m.status]}>{m.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {m.status !== "cancelado" && (
                          <Button
                            size="sm"
                            onClick={() => abrirPagamento(m)}
                            disabled={m.status === "pago"}
                            title={m.status === "pago" ? "Pagamento já recebido" : "Registrar recebimento"}
                          >
                            {m.status === "pago" ? "Recebido" : "Receber"}
                          </Button>
                        )}
                        {m.status !== "cancelado" && (
                          <Button size="sm" variant="outline" onClick={() => baixarReciboMensalidade(m)}>
                            <Receipt className="h-3.5 w-3.5 mr-1" /> Recibo
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setExtraDialog({ open: true, m })}>+ Item</Button>
                        {m.status !== "cancelado" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelarMensalidade(m)}>Cancelar</Button>
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
        </TabsContent>

        <TabsContent value="contas-pagar">
          <ContasPagarLista />
        </TabsContent>

        <TabsContent value="lucratividade">
          <LucratividadeDashboard />
        </TabsContent>
      </Tabs>

      {/* Dialog: Pagamento */}
      <Dialog open={pagDialog.open} onOpenChange={(o) => setPagDialog({ open: o, m: o ? pagDialog.m : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {pagDialog.m && `${residenteNome(pagDialog.m.residente_id)} · Total ${fmtBRL(Number(pagDialog.m.valor_total))}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor recebido</Label>
                <Input type="number" step="0.01" value={pagValor} onChange={(e) => setPagValor(e.target.value)} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={pagData} onChange={(e) => setPagData(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={pagForma} onValueChange={(v) => setPagForma(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={pagObs} onChange={(e) => setPagObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagDialog({ open: false, m: null })}>Cancelar</Button>
            <Button onClick={registrarPagamento}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lançamento extra */}
      <Dialog open={extraDialog.open} onOpenChange={(o) => setExtraDialog({ open: o, m: o ? extraDialog.m : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar lançamento</DialogTitle>
            <DialogDescription>
              {extraDialog.m && `Vinculado à mensalidade de ${residenteNome(extraDialog.m.residente_id)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={extraTipo}
                onValueChange={(v) => {
                  setExtraTipo(v as any);
                  if (v === "adicional_natalino" && !extraDesc) {
                    setExtraDesc("Adicional natalino (gratificação anual)");
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="extra">Extra (acréscimo)</SelectItem>
                  <SelectItem value="servico_terceiros">Serviço de terceiros</SelectItem>
                  <SelectItem value="adicional_natalino">Adicional natalino</SelectItem>
                  <SelectItem value="desconto">Desconto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} placeholder="Ex.: Compra de medicamento" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={extraValor} onChange={(e) => setExtraValor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtraDialog({ open: false, m: null })}>Cancelar</Button>
            <Button onClick={salvarLancamento}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}