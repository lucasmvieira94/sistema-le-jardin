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
import { supabase } from "@/integrations/supabase/client";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RegistroUsoFraldaFormProps {
  onSuccess: () => void;
}

export const RegistroUsoFraldaForm = ({ onSuccess }: RegistroUsoFraldaFormProps) => {
  const { registrarUso, estoques } = useFraldas();
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      estoque_fralda_id: "",
      residente_id: "",
      funcionario_id: "",
      data_uso: new Date().toISOString().split("T")[0],
      horario_uso: new Date().toTimeString().split(" ")[0].substring(0, 5),
      quantidade_usada: 1,
      tipo_troca: "",
      observacoes: "",
    },
  });

  const estoqueId = watch("estoque_fralda_id");
  const residenteId = watch("residente_id");
  const tipoTroca = watch("tipo_troca");

  // Buscar residentes
  const { data: residentes } = useQuery({
    queryKey: ["residentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");

      if (error) throw error;
      return data;
    },
  });

  // Buscar funcionários
  const { data: funcionarios } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");

      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (data: any) => {
    await registrarUso.mutateAsync(data);
    onSuccess();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar Uso de Fralda</DialogTitle>
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
                  {residente.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estoque_fralda_id">Tipo de Fralda *</Label>
          <Select
            value={estoqueId}
            onValueChange={(value) => setValue("estoque_fralda_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de fralda" />
            </SelectTrigger>
            <SelectContent>
              {estoques?.map((estoque) => (
                <SelectItem key={estoque.id} value={estoque.id}>
                  {estoque.tipo_fralda} - {estoque.tamanho} (Disponível:{" "}
                  {estoque.quantidade_atual})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="funcionario_id">Funcionário Responsável *</Label>
          <Select
            value={watch("funcionario_id")}
            onValueChange={(value) => setValue("funcionario_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o funcionário" />
            </SelectTrigger>
            <SelectContent>
              {funcionarios?.map((funcionario) => (
                <SelectItem key={funcionario.id} value={funcionario.id}>
                  {funcionario.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="data_uso">Data *</Label>
            <Input id="data_uso" type="date" {...register("data_uso", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="horario_uso">Horário *</Label>
            <Input
              id="horario_uso"
              type="time"
              {...register("horario_uso", { required: true })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quantidade_usada">Quantidade *</Label>
            <Input
              id="quantidade_usada"
              type="number"
              min="1"
              {...register("quantidade_usada", { required: true, valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_troca">Tipo de Troca</Label>
            <Select
              value={tipoTroca}
              onValueChange={(value) => setValue("tipo_troca", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rotina">Rotina</SelectItem>
                <SelectItem value="evacuacao">Evacuação</SelectItem>
                <SelectItem value="urgencia">Urgência</SelectItem>
                <SelectItem value="banho">Após Banho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            {...register("observacoes")}
            placeholder="Informações adicionais sobre a troca"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
          <Button type="submit">Registrar</Button>
        </div>
      </form>
    </>
  );
};
