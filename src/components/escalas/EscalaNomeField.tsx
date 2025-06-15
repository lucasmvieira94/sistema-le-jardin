
import { Input } from "@/components/ui/input";
import { FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
};
export default function EscalaNomeField({ register, errors }: Props) {
  return (
    <div>
      <label className="block mb-1 font-semibold text-green-800">
        Nome da Escala <span className="text-red-600">*</span>
      </label>
      <Input {...register("nomeEscala")} placeholder="Ex: Jornada 12x36" />
      {errors.nomeEscala && <span className="text-red-600 text-sm">{errors.nomeEscala.message}</span>}
    </div>
  );
}
