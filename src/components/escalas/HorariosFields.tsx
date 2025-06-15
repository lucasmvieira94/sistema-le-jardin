
import { Input } from "@/components/ui/input";
import { FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
};

export default function HorariosFields({ register, errors }: Props) {
  const entradaMsg =
    typeof errors.entrada?.message === "string"
      ? errors.entrada.message
      : undefined;
  const saidaMsg =
    typeof errors.saida?.message === "string"
      ? errors.saida.message
      : undefined;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <label className="block mb-1 font-semibold text-green-800">
          Entrada <span className="text-red-600">*</span>
        </label>
        <Input type="time" {...register("entrada")} />
        {entradaMsg && (
          <span className="text-red-600 text-sm">{entradaMsg}</span>
        )}
      </div>
      <div className="flex-1">
        <label className="block mb-1 font-semibold text-green-800">
          Saída <span className="text-red-600">*</span>
        </label>
        <Input type="time" {...register("saida")} />
        {saidaMsg && (
          <span className="text-red-600 text-sm">{saidaMsg}</span>
        )}
      </div>
    </div>
  );
}
