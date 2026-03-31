import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, ExternalLink, Check, Clock, FileText, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Solicitacao {
  id: string;
  token: string;
  contratante_nome: string | null;
  contratante_cpf: string | null;
  contratante_telefone: string | null;
  contratante_email: string | null;
  residente_nome: string | null;
  residente_data_nascimento: string | null;
  residente_observacoes: string | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  forma_pagamento: string | null;
  data_inicio_contrato: string | null;
  data_fim_contrato: string | null;
  observacoes_empresa: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aguardando_contratante: { label: "Aguardando Contratante", variant: "outline" },
  aguardando_empresa: { label: "Aguardando Empresa", variant: "secondary" },
  contrato_gerado: { label: "Contrato Gerado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export default function ContratosTemporarios() {
  const { toast } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Form state for finalizar
  const [valorMensalidade, setValorMensalidade] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [formaPagamento, setFormaPagamento] = useState("boleto");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [obsEmpresa, setObsEmpresa] = useState("");

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSolicitacoes(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  const criarNovaSolicitacao = async () => {
    setCreating(true);
    const { data, error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .insert({ status: "aguardando_contratante" } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar o link.", variant: "destructive" });
    } else {
      toast({ title: "Link criado!", description: "Copie o link e envie ao contratante." });
      fetchSolicitacoes();
    }
    setCreating(false);
  };

  const copiarLink = (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/contrato-temporario/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", description: "Cole e envie ao contratante." });
  };

  const abrirFinalizar = (s: Solicitacao) => {
    setSelectedSolicitacao(s);
    setValorMensalidade(s.valor_mensalidade?.toString() || "");
    setDiaVencimento(s.dia_vencimento?.toString() || "10");
    setFormaPagamento(s.forma_pagamento || "boleto");
    setDataInicio(s.data_inicio_contrato || "");
    setDataFim(s.data_fim_contrato || "");
    setObsEmpresa(s.observacoes_empresa || "");
    setShowFinalizarDialog(true);
  };

  const finalizarContrato = async () => {
    if (!selectedSolicitacao || !valorMensalidade || !dataInicio || !dataFim) {
      toast({ title: "Campos obrigatórios", description: "Preencha valor, data de início e data de fim.", variant: "destructive" });
      return;
    }

    setFinalizando(true);

    // Update the solicitacao with financial data
    const { error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .update({
        valor_mensalidade: parseFloat(valorMensalidade),
        dia_vencimento: parseInt(diaVencimento),
        forma_pagamento: formaPagamento,
        data_inicio_contrato: dataInicio,
        data_fim_contrato: dataFim,
        observacoes_empresa: obsEmpresa,
        status: "contrato_gerado",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", selectedSolicitacao.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível finalizar.", variant: "destructive" });
    } else {
      toast({ title: "Contrato finalizado!", description: "O contrato temporário foi registrado com sucesso." });
      setShowFinalizarDialog(false);
      fetchSolicitacoes();
    }
    setFinalizando(false);
  };

  const cancelarSolicitacao = async (id: string) => {
    const { error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .update({ status: "cancelado", updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (!error) {
      toast({ title: "Solicitação cancelada" });
      fetchSolicitacoes();
    }
  };

  const formatarMoeda = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contratos Temporários</h2>
          <p className="text-sm text-muted-foreground">Contratos de curta temporada (menos de 1 ano)</p>
        </div>
        <Button onClick={criarNovaSolicitacao} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Gerar Link
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum contrato temporário ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Gerar Link" para criar um link de preenchimento para o contratante.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Residente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.map((s) => {
                  const st = statusConfig[s.status] || statusConfig.aguardando_contratante;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{s.contratante_nome || "—"}</span>
                          {s.contratante_telefone && (
                            <p className="text-xs text-muted-foreground">{s.contratante_telefone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{s.residente_nome || "—"}</TableCell>
                      <TableCell>
                        {s.data_inicio_contrato && s.data_fim_contrato
                          ? `${format(new Date(s.data_inicio_contrato + "T12:00:00"), "dd/MM/yy")} - ${format(new Date(s.data_fim_contrato + "T12:00:00"), "dd/MM/yy")}`
                          : "—"}
                      </TableCell>
                      <TableCell>{s.valor_mensalidade ? formatarMoeda(s.valor_mensalidade) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {s.status === "aguardando_contratante" && (
                            <Button size="sm" variant="outline" onClick={() => copiarLink(s.token)} title="Copiar link">
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {s.status === "aguardando_empresa" && (
                            <Button size="sm" onClick={() => abrirFinalizar(s)}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Finalizar
                            </Button>
                          )}
                          {(s.status === "aguardando_contratante" || s.status === "aguardando_empresa") && (
                            <Button size="sm" variant="destructive" onClick={() => cancelarSolicitacao(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog para finalizar contrato */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar Contrato Temporário</DialogTitle>
            <DialogDescription>
              Dados do contratante: <strong>{selectedSolicitacao?.contratante_nome}</strong>
              <br />
              Residente: <strong>{selectedSolicitacao?.residente_nome}</strong>
              {selectedSolicitacao?.residente_observacoes && (
                <span className="block mt-1 text-xs">Obs: {selectedSolicitacao.residente_observacoes}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor da Mensalidade (R$) *</Label>
                <Input type="number" step="0.01" value={valorMensalidade} onChange={(e) => setValorMensalidade(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Dia do Vencimento</Label>
                <Input type="number" min="1" max="31" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início *</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data de Fim *</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Observações da Empresa</Label>
              <Textarea value={obsEmpresa} onChange={(e) => setObsEmpresa(e.target.value)} rows={2} />
            </div>

            <Button onClick={finalizarContrato} className="w-full" disabled={finalizando}>
              {finalizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar e Gerar Contrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
