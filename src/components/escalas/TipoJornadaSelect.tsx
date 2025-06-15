
import { Controller, Control, FieldErrors } from "react-hook-form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const tiposJornada = [
  "Jornada Diurna (8h/dia)",
  "Jornada Noturna (7h/dia – entre 22h e 5h)",
  "Jornada 12x36",
  "Escala 6x1",
  "Escala 5x2",
  "Escala 4x2",
  "Turno Ininterrupto de Revezamento (até 6h/dia)",
  "Jornada Parcial (até 30h semanais)",
  "Jornada Intermitente",
];

type Props = {
  control: Control<any>;
  errors: FieldErrors<any>;
};
export default function TipoJornadaSelect({ control, errors }: Props) {
  return (
    <div>
      <label className="block mb-1 font-semibold text-green-800">
        Tipo de Jornada <span className="text-red-600">*</span>
      </label>
      <Controller
        name="tipoJornada"
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de jornada" />
            </SelectTrigger>
            <SelectContent>
              {tiposJornada.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors.tipoJornada?.message && (
        <span className="text-red-600 text-sm">{errors.tipoJornada.message}</span>
      )}
    </div>
  );
}
