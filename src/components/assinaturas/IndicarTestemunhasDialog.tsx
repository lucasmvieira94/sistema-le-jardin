/**
 * Indicação de duas testemunhas (do quadro ativo) para uma advertência/suspensão
 * recusada ou não assinada no prazo. A regra é validada no servidor pela RPC
 * `indicar_testemunhas_advertencia`; as testemunhas assinam em Meus Documentos.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  advertenciaId: string;
  advertidoId: string;
  advertidoNome: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConcluido: () => void;
}

export default function IndicarTestemunhasDialog({ advertenciaId, advertidoId, advertidoNome, open, onOpenChange, onConcluido }: Props) {
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-ativos-testemunhas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome_completo, funcao").eq("ativo", true).order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });
  const opcoes = funcionarios.filter((f) => f.id !== advertidoId);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await (supabase as any).rpc("indicar_testemunhas_advertencia", {
      p_advertencia_id: advertenciaId, p_testemunhas: [t1, t2],
    });
    setSalvando(false);
    if (error) return toast({ variant: "destructive", title: "Não foi possível indicar", description: error.message });
    toast({ title: "Testemunhas indicadas", description: "Elas foram avisadas e já podem assinar em Meus Documentos." });
    setT1(""); setT2("");
    onConcluido();
    onOpenChange(false);
  };

  const seletor = (valor: string, set: (v: string) => void, outro: string, rotulo: string) => (
    <div className="space-y-1">
      <Label>{rotulo}</Label>
      <Select value={valor} onValueChange={set}>
        <SelectTrigger><SelectValue placeholder="Escolha um funcionário" /></SelectTrigger>
        <SelectContent>
          {opcoes.filter((f) => f.id !== outro).map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.nome_completo}{f.funcao ? ` — ${f.funcao}` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Indicar testemunhas</DialogTitle>
          <DialogDescription>
            {advertidoNome} não assinou a medida disciplinar. Escolha duas pessoas do quadro de funcionários:
            elas receberão o documento marcado como <strong>testemunha</strong> e assinarão com biometria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {seletor(t1, setT1, t2, "Testemunha 1")}
          {seletor(t2, setT2, t1, "Testemunha 2")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={!t1 || !t2 || t1 === t2 || salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enviar para as testemunhas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
