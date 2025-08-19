import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { Loader2 } from "lucide-react";

interface MedicamentoFormData {
  nome: string;
  principio_ativo?: string;
  dosagem?: string;
  forma_farmaceutica?: string;
  fabricante?: string;
  codigo_barras?: string;
  concentracao?: string;
  unidade_medida: string;
  prescricao_obrigatoria: boolean;
  controlado: boolean;
  observacoes?: string;
}

interface CadastroMedicamentoFormProps {
  onSuccess?: () => void;
}

export const CadastroMedicamentoForm = ({ onSuccess }: CadastroMedicamentoFormProps) => {
  const { cadastrarMedicamento } = useMedicamentos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    setValue, 
    watch, 
    reset, 
    formState: { errors } 
  } = useForm<MedicamentoFormData>({
    defaultValues: {
      unidade_medida: "unidade",
      prescricao_obrigatoria: false,
      controlado: false,
    }
  });

  const prescricaoObrigatoria = watch("prescricao_obrigatoria");
  const controlado = watch("controlado");

  const onSubmit = async (data: MedicamentoFormData) => {
    setIsSubmitting(true);
    try {
      await cadastrarMedicamento.mutateAsync({
        ...data,
        ativo: true,
      });
      reset();
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formasFarmaceuticas = [
    "comprimido", "capsula", "drágea", "xarope", "solução", "suspensão",
    "gotas", "injetável", "pomada", "creme", "gel", "supositório", "spray"
  ];

  const unidadesMedida = [
    "unidade", "ml", "mg", "g", "mcg", "UI", "dose", "ampola", "frasco"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastro de Medicamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome do Medicamento */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Medicamento *</Label>
              <Input
                id="nome"
                {...register("nome", { required: "Nome é obrigatório" })}
                placeholder="Ex: Paracetamol"
              />
              {errors.nome && (
                <p className="text-sm text-red-500">{errors.nome.message}</p>
              )}
            </div>

            {/* Princípio Ativo */}
            <div className="space-y-2">
              <Label htmlFor="principio_ativo">Princípio Ativo</Label>
              <Input
                id="principio_ativo"
                {...register("principio_ativo")}
                placeholder="Ex: Acetaminofeno"
              />
            </div>

            {/* Dosagem */}
            <div className="space-y-2">
              <Label htmlFor="dosagem">Dosagem</Label>
              <Input
                id="dosagem"
                {...register("dosagem")}
                placeholder="Ex: 500mg, 10ml/dose"
              />
            </div>

            {/* Concentração */}
            <div className="space-y-2">
              <Label htmlFor="concentracao">Concentração</Label>
              <Input
                id="concentracao"
                {...register("concentracao")}
                placeholder="Ex: 500mg/ml, 200mg/5ml"
              />
            </div>

            {/* Forma Farmacêutica */}
            <div className="space-y-2">
              <Label htmlFor="forma_farmaceutica">Forma Farmacêutica</Label>
              <Select onValueChange={(value) => setValue("forma_farmaceutica", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma" />
                </SelectTrigger>
                <SelectContent>
                  {formasFarmaceuticas.map((forma) => (
                    <SelectItem key={forma} value={forma}>
                      {forma.charAt(0).toUpperCase() + forma.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unidade de Medida */}
            <div className="space-y-2">
              <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
              <Select 
                defaultValue="unidade"
                onValueChange={(value) => setValue("unidade_medida", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidadesMedida.map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>
                      {unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fabricante */}
            <div className="space-y-2">
              <Label htmlFor="fabricante">Fabricante</Label>
              <Input
                id="fabricante"
                {...register("fabricante")}
                placeholder="Ex: EMS, Eurofarma"
              />
            </div>

            {/* Código de Barras */}
            <div className="space-y-2">
              <Label htmlFor="codigo_barras">Código de Barras</Label>
              <Input
                id="codigo_barras"
                {...register("codigo_barras")}
                placeholder="Código EAN ou interno"
              />
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label>Prescrição Obrigatória</Label>
                <p className="text-sm text-muted-foreground">
                  Requer prescrição médica
                </p>
              </div>
              <Switch
                checked={prescricaoObrigatoria}
                onCheckedChange={(checked) => setValue("prescricao_obrigatoria", checked)}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label>Medicamento Controlado</Label>
                <p className="text-sm text-muted-foreground">
                  Sujeito a controle especial
                </p>
              </div>
              <Switch
                checked={controlado}
                onCheckedChange={(checked) => setValue("controlado", checked)}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              {...register("observacoes")}
              placeholder="Informações adicionais sobre o medicamento..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={isSubmitting}
            >
              Limpar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Medicamento
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};