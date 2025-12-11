import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, Minus, Plus, User, Droplets, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";

interface RegistroUsoFraldaPublicoProps {
  funcionarioId: string;
  funcionarioNome: string;
  tenantId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RegistroUsoFraldaPublico = ({
  funcionarioId,
  funcionarioNome,
  tenantId,
  onSuccess,
  onCancel,
}: RegistroUsoFraldaPublicoProps) => {
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [residenteId, setResidenteId] = useState("");
  const [residenteNome, setResidenteNome] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [tipoTroca, setTipoTroca] = useState("rotina");
  const [observacoes, setObservacoes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar residentes
  const { data: residentes, isLoading: loadingResidentes } = useQuery({
    queryKey: ["residentes-publico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo, quarto")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  // Buscar estoques do residente
  const { data: estoques, isLoading: loadingEstoques } = useQuery({
    queryKey: ["estoque-fraldas-residente", residenteId, tenantId],
    queryFn: async () => {
      if (!residenteId || !tenantId) return [];
      const { data, error } = await supabase
        .from("estoque_fraldas")
        .select("*")
        .eq("ativo", true)
        .eq("residente_id", residenteId)
        .eq("tenant_id", tenantId)
        .order("tipo_fralda");
      if (error) throw error;
      return data;
    },
    enabled: !!residenteId && !!tenantId,
  });

  // Mutation para registrar uso
  const registrarUso = useMutation({
    mutationFn: async (dados: any) => {
      const { data, error } = await supabase
        .from("uso_fraldas")
        .insert([dados])
        .select()
        .single();
      if (error) throw error;

      // Atualizar estoque
      const estoque = estoques?.find((e) => e.id === dados.estoque_fralda_id);
      if (estoque) {
        await supabase
          .from("estoque_fraldas")
          .update({ quantidade_atual: estoque.quantidade_atual - dados.quantidade_usada })
          .eq("id", estoque.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-fraldas"] });
      queryClient.invalidateQueries({ queryKey: ["uso-fraldas"] });
      onSuccess();
    },
    onError: (error) => {
      console.error("Erro ao registrar uso:", error);
      toast.error("Erro ao registrar uso de fralda");
    },
  });

  const tiposTroca = [
    { value: "rotina", label: "Rotina", emoji: "🔄" },
    { value: "evacuacao", label: "Evacuação", emoji: "💩" },
    { value: "urgencia", label: "Urgência", emoji: "⚡" },
    { value: "banho", label: "Após Banho", emoji: "🚿" },
  ];

  const handleSelectResidente = (id: string, nome: string) => {
    setResidenteId(id);
    setResidenteNome(nome);
    setStep(2);
  };

  const handleSelectEstoque = (id: string) => {
    setEstoqueId(id);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!tenantId || !residenteId || !estoqueId || !funcionarioId) return;

    setIsSubmitting(true);
    try {
      await registrarUso.mutateAsync({
        tenant_id: tenantId,
        residente_id: residenteId,
        estoque_fralda_id: estoqueId,
        funcionario_id: funcionarioId,
        data_uso: new Date().toISOString().split("T")[0],
        horario_uso: new Date().toTimeString().split(" ")[0].substring(0, 5),
        quantidade_usada: quantidade,
        tipo_troca: tipoTroca,
        observacoes: observacoes || null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Selecionar Residente
  if (step === 1) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Selecione o Residente
          </DialogTitle>
          <DialogDescription>Toque no nome do residente para continuar</DialogDescription>
        </DialogHeader>
        {loadingResidentes ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-2 py-2">
              {residentes?.map((residente) => (
                <Button
                  key={residente.id}
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start text-left"
                  onClick={() => handleSelectResidente(residente.id, residente.nome_completo)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-base">{residente.nome_completo}</span>
                    {residente.quarto && (
                      <span className="text-sm text-muted-foreground">{residente.quarto}</span>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
        <Button variant="ghost" onClick={onCancel} className="mt-2">
          Cancelar
        </Button>
      </>
    );
  }

  // Step 2: Selecionar Fralda do Estoque
  if (step === 2) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Selecione a Fralda
          </DialogTitle>
          <DialogDescription>{residenteNome}</DialogDescription>
        </DialogHeader>
        {loadingEstoques ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-2 py-2">
              {estoques && estoques.length > 0 ? (
                estoques.map((estoque) => (
                  <Button
                    key={estoque.id}
                    variant="outline"
                    className="h-auto py-4 px-4 justify-between"
                    onClick={() => handleSelectEstoque(estoque.id)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-base">
                        {estoque.tipo_fralda} - {estoque.marca}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Tamanho: {estoque.tamanho}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          "text-lg font-bold",
                          estoque.quantidade_atual <= 10 ? "text-destructive" : "text-primary"
                        )}
                      >
                        {estoque.quantidade_atual}
                      </span>
                      <p className="text-xs text-muted-foreground">disponíveis</p>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma fralda cadastrada para este residente.</p>
                  <p className="text-sm mt-2">Cadastre o estoque primeiro.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        <Button variant="ghost" onClick={() => setStep(1)} className="mt-2">
          ← Voltar
        </Button>
      </>
    );
  }

  // Step 3: Confirmar detalhes
  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirmar Registro</DialogTitle>
        <DialogDescription>
          {residenteNome} • {funcionarioNome}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Tipo de Troca */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de Troca</label>
          <div className="grid grid-cols-2 gap-2">
            {tiposTroca.map((tipo) => (
              <Button
                key={tipo.value}
                type="button"
                variant={tipoTroca === tipo.value ? "default" : "outline"}
                className={cn("h-14 text-base", tipoTroca === tipo.value && "ring-2 ring-primary")}
                onClick={() => setTipoTroca(tipo.value)}
              >
                <span className="mr-2 text-xl">{tipo.emoji}</span>
                {tipo.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Quantidade */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quantidade</label>
          <div className="flex items-center justify-center gap-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full text-xl"
              onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
              disabled={quantidade <= 1}
            >
              <Minus className="h-6 w-6" />
            </Button>
            <span className="text-4xl font-bold min-w-[60px] text-center">{quantidade}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full text-xl"
              onClick={() => setQuantidade(quantidade + 1)}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Observações (opcional)</label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Alguma observação?"
            rows={2}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="h-14 text-lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-5 w-5" />
              Confirmar Registro
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={() => setStep(2)}>
          ← Voltar
        </Button>
      </div>
    </>
  );
};
