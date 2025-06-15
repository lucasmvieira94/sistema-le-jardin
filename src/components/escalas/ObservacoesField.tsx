
import { Textarea } from "@/components/ui/textarea";
import { UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
};
export default function ObservacoesField({ register }: Props) {
  return (
    <div>
      <label className="block mb-1 font-semibold text-green-800">Observações</label>
      <Textarea {...register("observacoes")} rows={2} placeholder="Ex: Escala noturna, considerar adicional noturno." />
    </div>
  );
}
