import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFraldas } from "@/hooks/useFraldas";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CadastroEstoqueFraldaFormProps {
  onSuccess: () => void;
  estoque?: any;
}

export const CadastroEstoqueFraldaForm = ({
  onSuccess,
  estoque,
}: CadastroEstoqueFraldaFormProps) => {
  const { criarEstoque, atualizarEstoque } = useFraldas();
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: estoque || {
      tipo_fralda: "",
      tamanho: "",
      quantidade_atual: 0,
      quantidade_minima: 100,
      unidade_medida: "unidades",
      localizacao: "",
      fornecedor: "",
      preco_unitario: 0,
      observacoes: "",
    },
  });

  const tamanho = watch("tamanho");

  const onSubmit = async (data: any) => {
    if (estoque) {
      await atualizarEstoque.mutateAsync({ ...data, id: estoque.id });
    } else {
      await criarEstoque.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {estoque ? "Editar Estoque de Fralda" : "Cadastrar Estoque de Fralda"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipo_fralda">Tipo de Fralda *</Label>
            <Input
              id="tipo_fralda"
              {...register("tipo_fralda", { required: true })}
              placeholder="Ex: Fralda Geriátrica"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tamanho">Tamanho *</Label>
            <Select
              value={tamanho}
              onValueChange={(value) => setValue("tamanho", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">P - Pequeno</SelectItem>
                <SelectItem value="M">M - Médio</SelectItem>
                <SelectItem value="G">G - Grande</SelectItem>
                <SelectItem value="GG">GG - Extra Grande</SelectItem>
                <SelectItem value="XG">XG - Super Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quantidade_atual">Quantidade Atual *</Label>
            <Input
              id="quantidade_atual"
              type="number"
              {...register("quantidade_atual", { required: true, valueAsNumber: true })}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade_minima">Quantidade Mínima *</Label>
            <Input
              id="quantidade_minima"
              type="number"
              {...register("quantidade_minima", { required: true, valueAsNumber: true })}
              placeholder="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="localizacao">Localização</Label>
            <Input
              id="localizacao"
              {...register("localizacao")}
              placeholder="Ex: Almoxarifado A - Prateleira 3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fornecedor">Fornecedor</Label>
            <Input
              id="fornecedor"
              {...register("fornecedor")}
              placeholder="Nome do fornecedor"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preco_unitario">Preço Unitário (R$)</Label>
            <Input
              id="preco_unitario"
              type="number"
              step="0.01"
              {...register("preco_unitario", { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_ultima_compra">Data Última Compra</Label>
            <Input
              id="data_ultima_compra"
              type="date"
              {...register("data_ultima_compra")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            {...register("observacoes")}
            placeholder="Informações adicionais sobre o estoque"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
          <Button type="submit">
            {estoque ? "Atualizar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </>
  );
};
