import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ContaPagar } from "@/hooks/financeiro/useContasPagar";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conta: ContaPagar | null;
  onSaved: () => void;
};

export default function BaixaPagamentoDialog({ open, onOpenChange, conta, onSaved }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("pix");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setData(new Date().toISOString().slice(0, 10));
      setForma("pix");
    }
  }, [open]);

  const baixar = async () => {
    if (!conta) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("contas_pagar")
      .update({ status: "pago", data_pagamento: data, forma_pagamento: forma })
      .eq("id", conta.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento confirmado", description: conta.recorrente ? "Próxima ocorrência criada." : undefined });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa em pagamento</DialogTitle>
          <DialogDescription>{conta?.descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={baixar} disabled={saving}>{saving ? "Confirmando..." : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
