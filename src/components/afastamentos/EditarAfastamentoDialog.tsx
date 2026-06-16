import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";

interface TipoAfastamento {
  id: number;
  descricao: string;
  remunerado: boolean;
}

interface EditarAfastamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  afastamentoId: string | null;
  onSaved: () => void;
}

/**
 * Diálogo para edição de afastamento, com auditoria.
 * Registra os dados anteriores e os novos no audit_log via RPC log_audit_event.
 */
export default function EditarAfastamentoDialog({
  open,
  onOpenChange,
  afastamentoId,
  onSaved,
}: EditarAfastamentoDialogProps) {
  const { logEvent } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipos, setTipos] = useState<TipoAfastamento[]>([]);
  const [original, setOriginal] = useState<any>(null);
  const [form, setForm] = useState({
    tipo_afastamento_id: "",
    tipo_periodo: "dias" as "dias" | "horas",
    data_inicio: "",
    data_fim: "",
    hora_inicio: "",
    hora_fim: "",
    quantidade_horas: "" as string | number,
    quantidade_dias: "" as string | number,
    observacoes: "",
  });

  useEffect(() => {
    if (!open || !afastamentoId) return;
    (async () => {
      setLoading(true);
      const [{ data: af }, { data: tps }] = await Promise.all([
        supabase.from("afastamentos").select("*").eq("id", afastamentoId).maybeSingle(),
        supabase.from("tipos_afastamento").select("id, descricao, remunerado").order("descricao"),
      ]);
      if (af) {
        setOriginal(af);
        setForm({
          tipo_afastamento_id: String(af.tipo_afastamento_id ?? ""),
          tipo_periodo: (af.tipo_periodo ?? "dias") as "dias" | "horas",
          data_inicio: af.data_inicio ?? "",
          data_fim: af.data_fim ?? "",
          hora_inicio: af.hora_inicio ?? "",
          hora_fim: af.hora_fim ?? "",
          quantidade_horas: af.quantidade_horas ?? "",
          quantidade_dias: af.quantidade_dias ?? "",
          observacoes: af.observacoes ?? "",
        });
      }
      if (tps) setTipos(tps as TipoAfastamento[]);
      setLoading(false);
    })();
  }, [open, afastamentoId]);

  async function handleSave() {
    if (!afastamentoId || !original) return;
    setSaving(true);
    try {
      const payload = {
        tipo_afastamento_id: Number(form.tipo_afastamento_id),
        tipo_periodo: form.tipo_periodo,
        data_inicio: form.data_inicio,
        data_fim: form.tipo_periodo === "dias" ? form.data_fim || null : null,
        hora_inicio: form.tipo_periodo === "horas" ? form.hora_inicio || null : null,
        hora_fim: form.tipo_periodo === "horas" ? form.hora_fim || null : null,
        quantidade_horas:
          form.tipo_periodo === "horas" && form.quantidade_horas !== ""
            ? Number(form.quantidade_horas)
            : null,
        quantidade_dias:
          form.tipo_periodo === "dias" && form.quantidade_dias !== ""
            ? Number(form.quantidade_dias)
            : null,
        observacoes: form.observacoes || null,
      };

      const { error } = await supabase.from("afastamentos").update(payload).eq("id", afastamentoId);
      if (error) throw error;

      await logEvent("afastamentos", "UPDATE", original, { id: afastamentoId, ...payload });

      toast({ title: "Afastamento atualizado", description: "Alterações salvas com sucesso." });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: err?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Afastamento</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo_afastamento_id}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_afastamento_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.descricao} {t.remunerado ? "(Remunerado)" : "(Não remunerado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Período</Label>
              <Select
                value={form.tipo_periodo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_periodo: v as "dias" | "horas" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dias">Dias</SelectItem>
                  <SelectItem value="horas">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              {form.tipo_periodo === "dias" && (
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={form.data_fim ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {form.tipo_periodo === "horas" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hora Início</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Hora Fim</Label>
                  <Input
                    type="time"
                    value={form.hora_fim ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, hora_fim: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {form.tipo_periodo === "dias" ? (
                <div>
                  <Label>Quantidade de Dias</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantidade_dias}
                    onChange={(e) => setForm((f) => ({ ...f, quantidade_dias: e.target.value }))}
                  />
                </div>
              ) : (
                <div>
                  <Label>Quantidade de Horas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantidade_horas}
                    onChange={(e) => setForm((f) => ({ ...f, quantidade_horas: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}