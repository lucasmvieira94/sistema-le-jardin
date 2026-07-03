import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIAS, FREQUENCIAS, type ContaPagar } from "@/hooks/financeiro/useContasPagar";
import { useTenant } from "@/hooks/useTenant";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conta?: ContaPagar | null;
  onSaved: () => void;
};

export default function ContaPagarForm({ open, onOpenChange, conta, onSaved }: Props) {
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState<string>("mensal");
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState("2");
  const [beneficiarioNome, setBeneficiarioNome] = useState("");
  const [beneficiarioDoc, setBeneficiarioDoc] = useState("");

  useEffect(() => {
    if (open) {
      setDescricao(conta?.descricao ?? "");
      setCategoria(conta?.categoria ?? "outros");
      setFornecedor(conta?.fornecedor ?? "");
      setValor(conta ? String(conta.valor) : "");
      setVencimento(conta?.data_vencimento ?? new Date().toISOString().slice(0, 10));
      setObservacoes(conta?.observacoes ?? "");
      setRecorrente(conta?.recorrente ?? false);
      setFrequencia(conta?.frequencia_recorrencia ?? "mensal");
      setParcelado(false);
      setNumParcelas("2");
      setBeneficiarioNome((conta as any)?.beneficiario_nome ?? "");
      setBeneficiarioDoc((conta as any)?.beneficiario_documento ?? "");
    }
  }, [open, conta]);

  const somarPorFrequencia = (dataISO: string, freq: string, n: number): string => {
    const [y, m, d] = dataISO.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    switch (freq) {
      case "semanal": dt.setDate(dt.getDate() + 7 * n); break;
      case "quinzenal": dt.setDate(dt.getDate() + 15 * n); break;
      case "mensal": dt.setMonth(dt.getMonth() + 1 * n); break;
      case "bimestral": dt.setMonth(dt.getMonth() + 2 * n); break;
      case "trimestral": dt.setMonth(dt.getMonth() + 3 * n); break;
      case "semestral": dt.setMonth(dt.getMonth() + 6 * n); break;
      case "anual": dt.setFullYear(dt.getFullYear() + 1 * n); break;
    }
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const salvar = async () => {
    if (!descricao || !valor || !vencimento) {
      toast({ title: "Preencha descrição, valor e vencimento", variant: "destructive" });
      return;
    }
    const totalParcelas = parcelado ? Math.max(2, Math.min(120, parseInt(numParcelas) || 0)) : 1;
    if (parcelado && (!totalParcelas || totalParcelas < 2)) {
      toast({ title: "Informe um número de parcelas válido (mínimo 2)", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      descricao,
      categoria,
      fornecedor: fornecedor || null,
      valor: Number(valor),
      data_vencimento: vencimento,
      observacoes: observacoes || null,
      recorrente: parcelado ? false : recorrente,
      frequencia_recorrencia: (parcelado || recorrente) ? frequencia : null,
      beneficiario_nome: beneficiarioNome || null,
      beneficiario_documento: beneficiarioDoc || null,
    };
    let error: any = null;
    if (conta?.id) {
      const r = await (supabase as any).from("contas_pagar").update(payload).eq("id", conta.id);
      error = r.error;
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.criado_por = u?.user?.id ?? null;
      payload.tenant_id = tenantId ?? null;
      if (parcelado) {
        const rows = Array.from({ length: totalParcelas }, (_, i) => ({
          ...payload,
          descricao: `${descricao} (${i + 1}/${totalParcelas})`,
          data_vencimento: somarPorFrequencia(vencimento, frequencia, i),
        }));
        const r = await (supabase as any).from("contas_pagar").insert(rows);
        error = r.error;
      } else {
        const r = await (supabase as any).from("contas_pagar").insert(payload);
        error = r.error;
      }
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: conta
        ? "Conta atualizada"
        : parcelado
          ? `${totalParcelas} parcelas cadastradas`
          : "Conta cadastrada",
    });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar conta" : "Nova conta a pagar"}</DialogTitle>
          <DialogDescription>Cadastre uma despesa do negócio.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Conta de luz - CEEE" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          {!conta?.id && (
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <Label className="cursor-pointer">Parcelada (nº fixo de parcelas)</Label>
                <p className="text-xs text-muted-foreground">Cria todas as parcelas agora, com vencimentos sequenciais</p>
              </div>
              <Switch
                checked={parcelado}
                onCheckedChange={(v) => { setParcelado(v); if (v) setRecorrente(false); }}
              />
            </div>
          )}
          {parcelado && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Número de parcelas</Label>
                <Input
                  type="number"
                  min={2}
                  max={120}
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                  placeholder="Ex.: 8"
                />
              </div>
              <div>
                <Label>Frequência</Label>
                <Select value={frequencia} onValueChange={setFrequencia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {!parcelado && (
            <>
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <Label className="cursor-pointer">Recorrente (contínua)</Label>
                  <p className="text-xs text-muted-foreground">Gera a próxima ocorrência ao dar baixa</p>
                </div>
                <Switch checked={recorrente} onCheckedChange={setRecorrente} />
              </div>
              {recorrente && (
                <div>
                  <Label>Frequência</Label>
                  <Select value={frequencia} onValueChange={setFrequencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
          <div className="rounded border p-3 space-y-2">
            <div>
              <Label className="text-sm">Beneficiário (para emissão de recibo)</Label>
              <p className="text-xs text-muted-foreground">Quem irá receber o pagamento — útil principalmente para pagamentos em dinheiro.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome completo</Label>
                <Input value={beneficiarioNome} onChange={(e) => setBeneficiarioNome(e.target.value)} placeholder="Ex.: João da Silva" />
              </div>
              <div>
                <Label className="text-xs">CPF / CNPJ</Label>
                <Input value={beneficiarioDoc} onChange={(e) => setBeneficiarioDoc(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
