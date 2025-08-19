import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { Loader2 } from "lucide-react";

interface EntradaEstoqueFormData {
  medicamento_id: string;
  lote?: string;
  data_validade?: string;
  quantidade: number;
  quantidade_minima: number;
  quantidade_maxima: number;
  preco_unitario?: number;
  fornecedor?: string;
  observacoes?: string;
}

interface EntradaEstoqueFormProps {
  onSuccess?: () => void;
}

export const EntradaEstoqueForm = ({ onSuccess }: EntradaEstoqueFormProps) => {
  const { medicamentos, adicionarEstoque } = useMedicamentos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    setValue, 
    reset, 
    formState: { errors } 
  } = useForm<EntradaEstoqueFormData>({
    defaultValues: {
      quantidade_minima: 10,
      quantidade_maxima: 1000,
    }
  });

  const onSubmit = async (data: EntradaEstoqueFormData) => {
    setIsSubmitting(true);
    try {
      await adicionarEstoque.mutateAsync({
        ...data,
        quantidade: Number(data.quantidade),
        quantidade_minima: Number(data.quantidade_minima),
        quantidade_maxima: Number(data.quantidade_maxima),
        preco_unitario: data.preco_unitario ? Number(data.preco_unitario) : undefined,
      });
      reset();
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrada de Estoque</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Seleção do Medicamento */}
          <div className="space-y-2">
            <Label htmlFor="medicamento_id">Medicamento *</Label>
            <Select onValueChange={(value) => setValue("medicamento_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um medicamento" />
              </SelectTrigger>
              <SelectContent>
                {medicamentos.map((medicamento) => (
                  <SelectItem key={medicamento.id} value={medicamento.id}>
                    {medicamento.nome} {medicamento.dosagem && `- ${medicamento.dosagem}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.medicamento_id && (
              <p className="text-sm text-red-500">Selecione um medicamento</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lote */}
            <div className="space-y-2">
              <Label htmlFor="lote">Lote</Label>
              <Input
                id="lote"
                {...register("lote")}
                placeholder="Número do lote"
              />
            </div>

            {/* Data de Validade */}
            <div className="space-y-2">
              <Label htmlFor="data_validade">Data de Validade</Label>
              <Input
                id="data_validade"
                type="date"
                {...register("data_validade")}
              />
            </div>

            {/* Quantidade */}
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                step="0.01"
                {...register("quantidade", { 
                  required: "Quantidade é obrigatória",
                  min: { value: 0.01, message: "Quantidade deve ser maior que 0" }
                })}
                placeholder="0"
              />
              {errors.quantidade && (
                <p className="text-sm text-red-500">{errors.quantidade.message}</p>
              )}
            </div>

            {/* Preço Unitário */}
            <div className="space-y-2">
              <Label htmlFor="preco_unitario">Preço Unitário (R$)</Label>
              <Input
                id="preco_unitario"
                type="number"
                min="0"
                step="0.01"
                {...register("preco_unitario")}
                placeholder="0,00"
              />
            </div>

            {/* Quantidade Mínima */}
            <div className="space-y-2">
              <Label htmlFor="quantidade_minima">Quantidade Mínima *</Label>
              <Input
                id="quantidade_minima"
                type="number"
                min="1"
                {...register("quantidade_minima", { 
                  required: "Quantidade mínima é obrigatória",
                  min: { value: 1, message: "Deve ser pelo menos 1" }
                })}
                placeholder="10"
              />
              {errors.quantidade_minima && (
                <p className="text-sm text-red-500">{errors.quantidade_minima.message}</p>
              )}
            </div>

            {/* Quantidade Máxima */}
            <div className="space-y-2">
              <Label htmlFor="quantidade_maxima">Quantidade Máxima *</Label>
              <Input
                id="quantidade_maxima"
                type="number"
                min="1"
                {...register("quantidade_maxima", { 
                  required: "Quantidade máxima é obrigatória",
                  min: { value: 1, message: "Deve ser pelo menos 1" }
                })}
                placeholder="1000"
              />
              {errors.quantidade_maxima && (
                <p className="text-sm text-red-500">{errors.quantidade_maxima.message}</p>
              )}
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-2">
            <Label htmlFor="fornecedor">Fornecedor</Label>
            <Input
              id="fornecedor"
              {...register("fornecedor")}
              placeholder="Nome do fornecedor"
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              {...register("observacoes")}
              placeholder="Informações adicionais sobre a entrada..."
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
              Registrar Entrada
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};