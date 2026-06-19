
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Controller, Control, FieldErrors, UseFormRegister } from "react-hook-form";

type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  control?: Control<any>;
};

export default function IntervaloFields({ register, errors, control }: Props) {
  const intervaloMsg =
    typeof errors.intervaloFim?.message === "string"
      ? errors.intervaloFim.message
      : undefined;

  return (
    <div className="space-y-3">
      {control && (
        <Controller
          control={control}
          name="intervaloPreAssinalado"
          render={({ field }) => (
            <div className="flex items-start justify-between rounded-lg border border-green-200 bg-green-50/50 p-3">
              <div className="pr-3">
                <p className="font-semibold text-green-800 text-sm">
                  Intervalo pré-assinalado
                </p>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o intervalo definido abaixo é descontado
                  automaticamente das horas trabalhadas e o funcionário NÃO
                  precisa registrar início/fim do intervalo. Quando desativado
                  (padrão), o funcionário registra o intervalo manualmente e
                  pode iniciar/finalizar quantas vezes precisar no dia.
                </p>
              </div>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
                aria-label="Intervalo pré-assinalado"
              />
            </div>
          )}
        />
      )}
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
