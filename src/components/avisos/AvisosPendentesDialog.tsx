/**
 * Avisos pendentes do funcionário (ex.: mudança de escala ou de revezamento).
 * Abre ao entrar no portal e só fecha depois que cada aviso tem o recebimento
 * confirmado. A confirmação grava data/hora no banco e na auditoria.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BellRing } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatarTimestampDataHora } from "@/utils/formatTimestamp";

interface Aviso { id: string; tipo: string; titulo: string; mensagem: string; created_at: string }

export default function AvisosPendentesDialog({ funcionarioId }: { funcionarioId: string | null }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const db = supabase as any;

  const carregar = useCallback(async () => {
    if (!funcionarioId) { setAvisos([]); return; }
    const { data, error } = await db.rpc("listar_avisos_pendentes_funcionario", { p_funcionario_id: funcionarioId });
    if (!error) setAvisos(data || []);
  }, [funcionarioId]);

  useEffect(() => { carregar(); }, [carregar]);

  const atual = avisos[0];

  const confirmar = async () => {
    if (!atual || !funcionarioId) return;
    setEnviando(true);
    const { error } = await db.rpc("confirmar_aviso_funcionario", { p_funcionario_id: funcionarioId, p_aviso_id: atual.id });
    setEnviando(false);
    if (error) { toast({ variant: "destructive", title: "Não foi possível confirmar", description: error.message }); return; }
    toast({ title: "Recebimento confirmado" });
    setCiente(false);
    setAvisos((l) => l.slice(1));
  };

  return (
    <Dialog open={!!atual}>
      <DialogContent className="max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        {atual && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 rounded-full bg-primary/10 p-3"><BellRing className="h-6 w-6 text-primary" /></div>
              <DialogTitle className="text-center">{atual.titulo}</DialogTitle>
              <DialogDescription className="text-center text-xs">
                Aviso de {formatarTimestampDataHora(atual.created_at)}{avisos.length > 1 ? ` · 1 de ${avisos.length}` : ""}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-relaxed">{atual.mensagem}</p>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={ciente} onCheckedChange={(v) => setCiente(v === true)} className="mt-0.5" />
              Li e estou ciente deste aviso.
            </label>
            <DialogFooter>
              <Button className="w-full" disabled={!ciente || enviando} onClick={confirmar}>Confirmar recebimento</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
