import { Controller, Control, FieldErrors } from "react-hook-form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const jornadasTrabalho = [
  { 
    label: "44h semanais – 8h/dia (Seg-Sex) + 4h Sábado", 
    value: "44h_8h_segsex_4h_sab", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 4, 0], 
      dias_trabalho_por_semana: 6, 
      dias_folga_por_ciclo: 1, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga"] 
    } 
  },
  { 
    label: "44h semanais – 8h48/dia (Seg-Sex)", 
    value: "44h_8h48_segsex", 
    metadata: { 
      horas_por_dia: [8.8, 8.8, 8.8, 8.8, 8.8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "40h semanais – 8h/dia (Seg-Sex)", 
    value: "40h_8h_segsex", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "36h semanais – 6h/dia (6x1)", 
    value: "36h_6h_6x1", 
    metadata: { 
      horas_por_dia: [6, 6, 6, 6, 6, 6, 0], 
      dias_trabalho_por_semana: 6, 
      dias_folga_por_ciclo: 1, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga"] 
    } 
  },
  { 
    label: "12x36 – 12h trabalho / 36h descanso", 
    value: "12x36", 
    metadata: { 
      horas_por_dia: [12, 0], 
      dias_trabalho_por_semana: 3.5, 
      dias_folga_por_ciclo: 1, 
      ciclo: ["trabalho", "folga"] 
    } 
  },
  { 
    label: "24x48 – 24h trabalho / 48h descanso", 
    value: "24x48", 
    metadata: { 
      horas_por_dia: [24, 0, 0], 
      dias_trabalho_por_semana: 2.33, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Escala 5x1", 
    value: "5x1", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0], 
      dias_trabalho_por_semana: 5.83, 
      dias_folga_por_ciclo: 1, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga"] 
    } 
  },
  { 
    label: "Escala 5x2", 
    value: "5x2", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Escala 6x1", 
    value: "6x1", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 8, 0], 
      dias_trabalho_por_semana: 6, 
      dias_folga_por_ciclo: 1, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga"] 
    } 
  },
  { 
    label: "Escala 4x2", 
    value: "4x2", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 4.66, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Turno Fixo – Manhã (8h)", 
    value: "turno_manha", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Turno Fixo – Tarde (8h)", 
    value: "turno_tarde", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Turno Fixo – Noite (8h)", 
    value: "turno_noite", 
    metadata: { 
      horas_por_dia: [8, 8, 8, 8, 8, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
    } 
  },
  { 
    label: "Turno Parcial – Meio período (4h/dia)", 
    value: "turno_parcial_4h", 
    metadata: { 
      horas_por_dia: [4, 4, 4, 4, 4, 0, 0], 
      dias_trabalho_por_semana: 5, 
      dias_folga_por_ciclo: 2, 
      ciclo: ["trabalho", "trabalho", "trabalho", "trabalho", "trabalho", "folga", "folga"] 
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