import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";

interface CadastroEstoqueFraldaFormProps {
  onSuccess: () => void;
  estoque?: any;
}

export const CadastroEstoqueFraldaForm = ({
  onSuccess,
  estoque,
}: CadastroEstoqueFraldaFormProps) => {
  const { criarEstoque, atualizarEstoque } = useFraldas();
  
  // Buscar residentes ativos
  const { data: residentes } = useQuery({
    queryKey: ["residentes-ativos"],
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

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: estoque || {
      residente_id: "",
      tipo_fralda: "",
      marca: "",
      tamanho: "",
      quantidade_atual: 0,
      observacoes: "",
    },
  });

  const residenteId = watch("residente_id");
  const tipoFralda = watch("tipo_fralda");
  const marca = watch("marca");
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
        <div className="space-y-2">
          <Label htmlFor="residente_id">Residente *</Label>
          <Select
            value={residenteId}
            onValueChange={(value) => setValue("residente_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o residente" />
            </SelectTrigger>
            <SelectContent>
              {residentes?.map((residente) => (
                <SelectItem key={residente.id} value={residente.id}>
                  {residente.nome_completo} {residente.quarto ? `(${residente.quarto})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipo_fralda">Tipo de Fralda *</Label>
          <Select
            value={tipoFralda}
            onValueChange={(value) => setValue("tipo_fralda", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="De Vestir">De Vestir</SelectItem>
              <SelectItem value="Convencional">Convencional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marca">Marca *</Label>
          <Select
            value={marca}
            onValueChange={(value) => setValue("marca", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TENA">TENA</SelectItem>
              <SelectItem value="BIGFRAL">BIGFRAL</SelectItem>
              <SelectItem value="PLENITUD">PLENITUD</SelectItem>
              <SelectItem value="COTIDIAN">COTIDIAN</SelectItem>
              <SelectItem value="BIOFRAL">BIOFRAL</SelectItem>
              <SelectItem value="MAXCLEAN">MAXCLEAN</SelectItem>
              <SelectItem value="PROTEFRAL">PROTEFRAL</SelectItem>
              <SelectItem value="DAUF">DAUF</SelectItem>
              <SelectItem value="NEEDS">NEEDS</SelectItem>
              <SelectItem value="SENEXCONFORT">SENEXCONFORT</SelectItem>
              <SelectItem value="OUTRAS">OUTRAS</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="space-y-2">
          <Label htmlFor="quantidade_atual">Quantidade Entrando *</Label>
          <Input
            id="quantidade_atual"
            type="number"
            {...register("quantidade_atual", { required: true, valueAsNumber: true })}
            placeholder="0"
          />
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
