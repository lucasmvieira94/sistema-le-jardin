import { Controller, Control, FieldErrors } from "react-hook-form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const jornadasTrabalho = [
  {
    label: "44h semanais – 8h/dia (Seg-Sex) + 4h Sábado",
    value: "44h_8h_segsex_4h_sab",
    metadata: {
      horas_por_dia: 8,
      dias_trabalho_por_semana: 5.5,
      dias_folga_por_ciclo: 1,
      ciclo: "semanal"
    }
  },
  {
    label: "40h semanais – 8h/dia (Seg-Sex)",
    value: "40h_8h_segsex",
    metadata: {
      horas_por_dia: 8,
      dias_trabalho_por_semana: 5,
      dias_folga_por_ciclo: 2,
      ciclo: "semanal"
    }
  },
  {
    label: "36h semanais – 6h/dia (Seg-Sab)",
    value: "36h_6h_seg_sab",
    metadata: {
      horas_por_dia: 6,
      dias_trabalho_por_semana: 6,
      dias_folga_por_ciclo: 1,
      ciclo: "semanal"
    }
  },
  {
    label: "12x36 – 12h trabalho / 36h descanso",
    value: "12x36",
    metadata: {
      horas_por_dia: 12,
      dias_trabalho_por_semana: 3.5,
      dias_folga_por_ciclo: 1,
      ciclo: "alternado"
    }
  },
  {
    label: "24x48 – 24h trabalho / 48h descanso",
    value: "24x48",
    metadata: {
      horas_por_dia: 24,
      dias_trabalho_por_semana: 2.33,
      dias_folga_por_ciclo: 2,
      ciclo: "cada_3_dias"
    }
  },
  {
    label: "5x2 – Segunda a Sexta",
    value: "5x2",
    metadata: {
      horas_por_dia: 8,
      dias_trabalho_por_semana: 5,
      dias_folga_por_ciclo: 2,
      ciclo: "semanal"
    }
  },
  {
    label: "6x1 – Seis dias de trabalho e um de folga",
    value: "6x1",
    metadata: {
      horas_por_dia: 8,
      dias_trabalho_por_semana: 6,
      dias_folga_por_ciclo: 1,
      ciclo: "semanal"
    }
  }
];

type Props = {
  control: Control<any>;
  errors: FieldErrors<any>;
};

export default function JornadaTrabalhoSelect({ control, errors }: Props) {
  const message =
    typeof errors.jornadaTrabalho?.message === "string"
      ? errors.jornadaTrabalho.message
      : undefined;

  return (
    <div>
      <label className="block mb-1 font-semibold text-green-800">
        Jornada de Trabalho <span className="text-red-600">*</span>
      </label>
      <Controller
        name="jornadaTrabalho"
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a jornada de trabalho" />
            </SelectTrigger>
            <SelectContent>
              {jornadasTrabalho.map((jornada) => (
                <SelectItem key={jornada.value} value={jornada.value}>
                  {jornada.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {message && (
        <span className="text-red-600 text-sm">{message}</span>
      )}
    </div>
  );
}

export { jornadasTrabalho };