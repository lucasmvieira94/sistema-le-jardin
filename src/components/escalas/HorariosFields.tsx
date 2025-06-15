
import { Input } from "@/components/ui/input";
import { FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
};

export default function HorariosFields({ register, errors }: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <label className="block mb-1 font-semibold text-green-800">
          Entrada <span className="text-red-600">*</span>
        </label>
        <Input type="time" {...register("entrada")} />
        {errors.entrada?.message && (
          <span className="text-red-600 text-sm">{errors.entrada.message}</span>
        )}
      </div>
      <div className="flex-1">
        <label className="block mb-1 font-semibold text-green-800">
          Saída <span className="text-red-600">*</span>
        </label>
        <Input type="time" {...register("saida")} />
        {errors.saida?.message && (
          <span className="text-red-600 text-sm">{errors.saida.message}</span>
        )}
      </div>
    </div>
  );
}
