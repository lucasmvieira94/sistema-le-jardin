import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface AssinaturaAdvertenciaFormProps {
  advertenciaId: string;
  currentData: {
    testemunha_1: string | null;
    cpf_testemunha_1: string | null;
    testemunha_2: string | null;
    cpf_testemunha_2: string | null;
    funcionario_recusou_assinar: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AssinaturaAdvertenciaForm({
  advertenciaId,
  currentData,
  onSuccess,
  onCancel,
}: AssinaturaAdvertenciaFormProps) {
  const [loading, setLoading] = useState(false);
  const [testemunha1, setTestemunha1] = useState(currentData.testemunha_1 || "");
  const [cpfTestemunha1, setCpfTestemunha1] = useState(currentData.cpf_testemunha_1 || "");
  const [testemunha2, setTestemunha2] = useState(currentData.testemunha_2 || "");
  const [cpfTestemunha2, setCpfTestemunha2] = useState(currentData.cpf_testemunha_2 || "");
  const [recusouAssinar, setRecusouAssinar] = useState(currentData.funcionario_recusou_assinar);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (recusouAssinar && !testemunha1) {
      toast({ variant: "destructive", title: "Informe ao menos uma testemunha quando há recusa de assinatura." });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("advertencias_suspensoes")
      .update({
        testemunha_1: testemunha1 || null,
        cpf_testemunha_1: cpfTestemunha1 || null,
        testemunha_2: testemunha2 || null,
        cpf_testemunha_2: cpfTestemunha2 || null,
        funcionario_recusou_assinar: recusouAssinar,
      })
      .eq("id", advertenciaId);

    setLoading(false);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    } else {
      toast({ title: "Dados de assinatura atualizados com sucesso." });
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Testemunhas e Assinatura</h3>
      <p className="text-sm text-muted-foreground">
        Preencha os dados das testemunhas e indique se o funcionário recusou assinar o documento.
      </p>

      {/* Recusa */}
      <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/30">
        <Switch checked={recusouAssinar} onCheckedChange={setRecusouAssinar} />
        <Label className="font-medium">Funcionário recusou-se a assinar</Label>
      </div>

      {/* Testemunha 1 */}
      <div className="rounded-md border p-3 space-y-3">
        <p className="text-sm font-medium">Testemunha 1</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input
              value={testemunha1}
              onChange={e => setTestemunha1(e.target.value)}
              placeholder="Nome completo da testemunha"
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label>CPF</Label>
            <Input
              value={cpfTestemunha1}
              onChange={e => setCpfTestemunha1(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
        </div>
      </div>

      {/* Testemunha 2 */}
      <div className="rounded-md border p-3 space-y-3">
        <p className="text-sm font-medium">Testemunha 2</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input
              value={testemunha2}
              onChange={e => setTestemunha2(e.target.value)}
              placeholder="Nome completo da testemunha"
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label>CPF</Label>
            <Input
              value={cpfTestemunha2}
              onChange={e => setCpfTestemunha2(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
