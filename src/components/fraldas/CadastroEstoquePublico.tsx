import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, User, Package, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import { Label } from "@/components/ui/label";

interface CadastroEstoquePublicoProps {
  tenantId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TIPOS_FRALDA = ["De Vestir", "Convencional"];
const MARCAS = [
  "TENA",
  "BIGFRAL",
  "PLENITUD",
  "COTIDIAN",
  "BIOFRAL",
  "MAXCLEAN",
  "PROTEFRAL",
  "DAUF",
  "NEEDS",
  "SENEXCONFORT",
  "Outras",
];
const TAMANHOS = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

export const CadastroEstoquePublico = ({
  tenantId,
  onSuccess,
  onCancel,
}: CadastroEstoquePublicoProps) => {
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [residenteId, setResidenteId] = useState("");
  const [residenteNome, setResidenteNome] = useState("");
  const [tipoFralda, setTipoFralda] = useState("");
  const [marca, setMarca] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [quantidade, setQuantidade] = useState("");
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

  // Mutation para criar estoque
  const criarEstoque = useMutation({
    mutationFn: async (dados: any) => {
      const { data, error } = await supabase
        .from("estoque_fraldas")
        .insert([dados])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-fraldas"] });
      onSuccess();
    },
    onError: (error) => {
      console.error("Erro ao cadastrar estoque:", error);
      toast.error("Erro ao cadastrar estoque de fraldas");
    },
  });

  const handleSelectResidente = (id: string, nome: string) => {
    setResidenteId(id);
    setResidenteNome(nome);
    setStep(2);
  };

  const handleSelectTipo = (tipo: string) => {
    setTipoFralda(tipo);
    setStep(3);
  };

  const handleSelectMarca = (m: string) => {
    setMarca(m);
    setStep(4);
  };

  const handleSelectTamanho = (t: string) => {
    setTamanho(t);
    setStep(5);
  };

  const handleSubmit = async () => {
    if (!tenantId || !residenteId || !tipoFralda || !marca || !tamanho) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const quantidadeNum = parseInt(quantidade) || 0;
    if (quantidadeNum <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }

    setIsSubmitting(true);
    try {
      await criarEstoque.mutateAsync({
        tenant_id: tenantId,
        residente_id: residenteId,
        tipo_fralda: tipoFralda,
        marca: marca,
        tamanho: tamanho,
        quantidade_atual: quantidadeNum,
        observacoes: observacoes || null,
        ativo: true,
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
          <DialogDescription>Para quem é o estoque de fraldas?</DialogDescription>
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

  // Step 2: Tipo de Fralda
  if (step === 2) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tipo de Fralda
          </DialogTitle>
          <DialogDescription>{residenteNome}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {TIPOS_FRALDA.map((tipo) => (
            <Button
              key={tipo}
              variant="outline"
              className={cn(
                "h-16 text-lg justify-center",
                tipoFralda === tipo && "border-primary bg-primary/10"
              )}
              onClick={() => handleSelectTipo(tipo)}
            >
              {tipo}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setStep(1)} className="mt-2">
          ← Voltar
        </Button>
      </>
    );
  }

  // Step 3: Marca
  if (step === 3) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Marca da Fralda</DialogTitle>
          <DialogDescription>
            {residenteNome} • {tipoFralda}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid gap-2 py-2">
            {MARCAS.map((m) => (
              <Button
                key={m}
                variant="outline"
                className={cn(
                  "h-14 text-base justify-center",
                  marca === m && "border-primary bg-primary/10"
                )}
                onClick={() => handleSelectMarca(m)}
              >
                {m}
              </Button>
            ))}
          </div>
        </ScrollArea>
        <Button variant="ghost" onClick={() => setStep(2)} className="mt-2">
          ← Voltar
        </Button>
      </>
    );
  }

  // Step 4: Tamanho
  if (step === 4) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Tamanho da Fralda</DialogTitle>
          <DialogDescription>
            {residenteNome} • {tipoFralda} • {marca}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
          {TAMANHOS.map((t) => (
            <Button
              key={t}
              variant="outline"
              className={cn(
                "h-16 text-lg font-bold",
                tamanho === t && "border-primary bg-primary/10"
              )}
              onClick={() => handleSelectTamanho(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setStep(3)} className="mt-2">
          ← Voltar
        </Button>
      </>
    );
  }

  // Step 5: Quantidade e Observações
  return (
    <>
      <DialogHeader>
        <DialogTitle>Quantidade e Observações</DialogTitle>
        <DialogDescription>
          {residenteNome} • {tipoFralda} • {marca} • {tamanho}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade *</Label>
          <Input
            id="quantidade"
            type="number"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Quantidade de fraldas"
            className="h-14 text-lg text-center"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações (opcional)</Label>
          <Textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Alguma observação sobre o estoque?"
            rows={3}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !quantidade}
          className="h-14 text-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cadastrando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-5 w-5" />
              Cadastrar Estoque
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={() => setStep(4)}>
          ← Voltar
        </Button>
      </div>
    </>
  );
};
