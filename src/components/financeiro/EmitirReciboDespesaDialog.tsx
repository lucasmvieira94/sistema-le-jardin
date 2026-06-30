import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gerarReciboDespesaPDF } from "@/utils/reciboDespesaPDF";
import { CATEGORIAS, type ContaPagar } from "@/hooks/financeiro/useContasPagar";
import { FileText, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conta: ContaPagar | null;
  onSaved?: () => void;
};

const labelCat = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;

export default function EmitirReciboDespesaDialog({ open, onOpenChange, conta, onSaved }: Props) {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [emitindo, setEmitindo] = useState(false);

  useEffect(() => {
    if (open && conta) {
      setNome((conta as any).beneficiario_nome ?? conta.fornecedor ?? "");
      setDocumento((conta as any).beneficiario_documento ?? "");
      setObservacoes("");
    }
  }, [open, conta]);

  const emitir = async () => {
    if (!conta) return;
    if (!nome.trim()) {
      toast({ title: "Informe o nome do beneficiário", variant: "destructive" });
      return;
    }
    setEmitindo(true);
    try {
      // Persiste os dados do beneficiário na conta (para reemissões futuras).
      await (supabase as any)
        .from("contas_pagar")
        .update({
          beneficiario_nome: nome.trim(),
          beneficiario_documento: documento.trim() || null,
        })
        .eq("id", conta.id);

      const numeroRecibo = `RD-${conta.id.slice(0, 8).toUpperCase()}`;
      await gerarReciboDespesaPDF({
        contaId: conta.id,
        tenantId: conta.tenant_id ?? null,
        descricao: conta.descricao,
        categoria: labelCat(conta.categoria),
        beneficiarioNome: nome.trim(),
        beneficiarioDocumento: documento.trim() || null,
        valor: Number(conta.valor),
        dataPagamento: conta.data_pagamento ?? new Date().toISOString().slice(0, 10),
        dataVencimento: conta.data_vencimento,
        formaPagamento: conta.forma_pagamento,
        numeroRecibo,
        observacoes: observacoes.trim() || null,
      });

      toast({ title: "Recibo emitido", description: "PDF gerado com sucesso." });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Falha ao emitir recibo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setEmitindo(false);
    }
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Emitir recibo de pagamento
          </DialogTitle>
          <DialogDescription>
            Comprovante de quitação do valor pago — recomendado para pagamentos em dinheiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded border p-3 text-sm bg-muted/30">
            <div><span className="text-muted-foreground">Descrição:</span> <span className="font-medium">{conta.descricao}</span></div>
            <div><span className="text-muted-foreground">Valor:</span> <span className="font-semibold">{Number(conta.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
            <div><span className="text-muted-foreground">Forma:</span> {(conta.forma_pagamento ?? "—").toUpperCase()}</div>
          </div>
          <div>
            <Label>Nome do beneficiário *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João da Silva" />
          </div>
          <div>
            <Label>CPF / CNPJ do beneficiário</Label>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Opcional, porém recomendado" />
          </div>
          <div>
            <Label>Observações adicionais</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={emitindo}>Cancelar</Button>
          <Button onClick={emitir} disabled={emitindo}>
            {emitindo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Emitir Recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}