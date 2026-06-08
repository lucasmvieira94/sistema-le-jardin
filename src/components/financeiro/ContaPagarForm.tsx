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

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conta?: ContaPagar | null;
  onSaved: () => void;
};

export default function ContaPagarForm({ open, onOpenChange, conta, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState<string>("mensal");

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
    }
  }, [open, conta]);

  const salvar = async () => {
    if (!descricao || !valor || !vencimento) {
      toast({ title: "Preencha descrição, valor e vencimento", variant: "destructive" });
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
      recorrente,
      frequencia_recorrencia: recorrente ? frequencia : null,
    };
    let error: any = null;
    if (conta?.id) {
      const r = await (supabase as any).from("contas_pagar").update(payload).eq("id", conta.id);
      error = r.error;
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.criado_por = u?.user?.id ?? null;
      const r = await (supabase as any).from("contas_pagar").insert(payload);
      error = r.error;
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: conta ? "Conta atualizada" : "Conta cadastrada" });
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
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label className="cursor-pointer">Recorrente</Label>
              <p className="text-xs text-muted-foreground">Gera próxima ocorrência ao dar baixa</p>
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
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
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
