import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ContaPagar } from "@/hooks/financeiro/useContasPagar";
import { Paperclip, Loader2, FileCheck2, X } from "lucide-react";

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
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setData(new Date().toISOString().slice(0, 10));
      setForma("pix");
      setArquivo(null);
    }
  }, [open]);

  const baixar = async () => {
    if (!conta) return;
    setSaving(true);
    let anexo_url: string | null = null;
    try {
      if (arquivo) {
        setUploading(true);
        const ext = arquivo.name.split(".").pop() || "bin";
        const path = `${conta.tenant_id ?? "sem-tenant"}/${conta.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("comprovantes-pagamento")
          .upload(path, arquivo, { upsert: true, contentType: arquivo.type || undefined });
        setUploading(false);
        if (up.error) throw up.error;
        anexo_url = up.data.path;
      }
    } catch (e: any) {
      setUploading(false);
      setSaving(false);
      toast({ title: "Falha ao enviar comprovante", description: e?.message ?? String(e), variant: "destructive" });
      return;
    }

    const update: Record<string, any> = { status: "pago", data_pagamento: data, forma_pagamento: forma };
    if (anexo_url) update.anexo_url = anexo_url;

    const { error } = await (supabase as any)
      .from("contas_pagar")
      .update(update)
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

          <div>
            <Label>Comprovante de pagamento (opcional)</Label>
            <div className="mt-1 flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2 rounded border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
                  {arquivo ? (
                    <>
                      <FileCheck2 className="h-4 w-4 text-emerald-600" />
                      <span className="truncate">{arquivo.name}</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4" />
                      <span>Selecionar imagem ou PDF</span>
                    </>
                  )}
                </div>
              </label>
              {arquivo && (
                <Button type="button" size="icon" variant="ghost" onClick={() => setArquivo(null)} title="Remover">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={baixar} disabled={saving || uploading}>
            {(saving || uploading) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {uploading ? "Enviando comprovante..." : saving ? "Confirmando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
