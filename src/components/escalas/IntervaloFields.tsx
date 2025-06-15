
import { Input } from "@/components/ui/input";
import { FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
};

export default function IntervaloFields({ register, errors }: Props) {
  const intervaloMsg =
    typeof errors.intervaloFim?.message === "string"
      ? errors.intervaloFim.message
      : undefined;

  return (
    <div>
      <label className="block mb-1 font-semibold text-green-800">
        Intervalo (opcional)
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input type="time" {...register("intervaloInicio")} placeholder="Início" />
        </div>
        <span className="self-center text-muted-foreground">às</span>
        <div className="flex-1">
          <Input type="time" {...register("intervaloFim")} placeholder="Fim" />
        </div>
      </div>
      {intervaloMsg && (
        <span className="text-red-600 text-sm">{intervaloMsg}</span>
      )}
    </div>
  );
}
