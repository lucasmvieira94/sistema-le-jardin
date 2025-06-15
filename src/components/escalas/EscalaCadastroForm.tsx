
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

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

const diasSemanaTodos = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

// Validações CLT
const escalaSchema = z.object({
  nomeEscala: z.string().min(2, "Nome obrigatório"),
  tipoJornada: z.string(),
  entrada: z.string().min(1, "Informe o horário"),
  saida: z.string().min(1, "Informe o horário"),
  intervaloInicio: z.string().optional(),
  intervaloFim: z.string().optional(),
  diasSemana: z.array(z.string()).min(1, "Selecione pelo menos um dia"),
  observacoes: z.string().optional(),
}).refine((data) => {
    if (!data.entrada || !data.saida) return true;
    return data.entrada < data.saida;
  }, {
    message: "Horário de entrada deve ser menor que o de saída",
    path: ["saida"],
  })
  .refine((data) => {
    if (
      [
        "Jornada Diurna (8h/dia)",
        "Escala 6x1",
        "Jornada 12x36",
        "Escala 5x2",
        "Escala 4x2"
      ].includes(data.tipoJornada)
    ) {
      // Intervalo obrigatório e mínimo de 1h para essas jornadas (maiores que 6h)
      return (
        !!data.intervaloInicio &&
        !!data.intervaloFim &&
        data.intervaloFim > data.intervaloInicio &&
        getIntervaloMinutos(data.intervaloInicio, data.intervaloFim) >= 60
      );
    }
    return true;
  }, {
    message: "Obrigatório ao menos 1h de intervalo para jornadas acima de 6h",
    path: ["intervaloFim"],
  });

function getIntervaloMinutos(i: string | undefined, f: string | undefined) {
  if (!i || !f) return 0;
  const [ih, im] = i.split(":").map(Number);
  const [fh, fm] = f.split(":").map(Number);
  return (fh * 60 + fm) - (ih * 60 + im);
}

// Omit observacoes do type, pois é opcional
type EscalaCadastro = z.infer<typeof escalaSchema>;

export default function EscalaCadastroForm() {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<EscalaCadastro>({
    resolver: zodResolver(escalaSchema),
    defaultValues: { diasSemana: [] }
  });

  // Multiselect gerenciado manualmente pelo useState
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);

  const onSubmit = async (data: EscalaCadastro) => {
    // Aqui você salvaria no Supabase. Por enquanto, só simula e reseta.
    toast({
      title: "Escala cadastrada!",
      description: "Sua escala foi salva com sucesso.",
      duration: 4000,
    });
    reset();
    setDiasSelecionados([]);
  };

  const toggleDia = (dia: string) => {
    setDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  return (
    <form 
      onSubmit={handleSubmit((form) => onSubmit({ ...form, diasSemana: diasSelecionados }))}
      className="bg-white rounded-xl p-6 shadow-lg flex flex-col gap-5 mt-4 md:mt-0"
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold text-green-700 mb-3">Nova Escala de Trabalho</h2>

      {/* Nome da escala */}
      <div>
        <label className="block mb-1 font-semibold text-green-800">
          Nome da Escala <span className="text-red-600">*</span>
        </label>
        <Input {...register("nomeEscala")} placeholder="Ex: Jornada 12x36" />
        {errors.nomeEscala && <span className="text-red-600 text-sm">{errors.nomeEscala.message}</span>}
      </div>

      {/* Tipo de jornada */}
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
        {errors.tipoJornada && <span className="text-red-600 text-sm">{errors.tipoJornada.message}</span>}
      </div>

      {/* Horários */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block mb-1 font-semibold text-green-800">
            Entrada <span className="text-red-600">*</span>
          </label>
          <Input type="time" {...register("entrada")} />
          {errors.entrada && <span className="text-red-600 text-sm">{errors.entrada.message}</span>}
        </div>
        <div className="flex-1">
          <label className="block mb-1 font-semibold text-green-800">
            Saída <span className="text-red-600">*</span>
          </label>
          <Input type="time" {...register("saida")} />
          {errors.saida && <span className="text-red-600 text-sm">{errors.saida.message}</span>}
        </div>
      </div>

      {/* Intervalo */}
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
        {errors.intervaloFim && <span className="text-red-600 text-sm">{errors.intervaloFim.message}</span>}
      </div>

      {/* Dias da semana multiselect */}
      <div>
        <label className="block mb-1 font-semibold text-green-800">
          Dias da Semana <span className="text-red-600">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {diasSemanaTodos.map((dia) => (
            <button
              type="button"
              key={dia}
              className={`px-3 py-1 rounded-lg border
              ${diasSelecionados.includes(dia)
                  ? "bg-green-600 text-white border-green-700"
                  : "bg-green-50 text-green-900 border-green-300"
                } hover:bg-green-200 transition`}
              onClick={() => toggleDia(dia)}
            >
              {dia}
            </button>
          ))}
        </div>
        {errors.diasSemana && <span className="text-red-600 text-sm">{errors.diasSemana.message}</span>}
      </div>

      {/* Observações */}
      <div>
        <label className="block mb-1 font-semibold text-green-800">Observações</label>
        <Textarea {...register("observacoes")} rows={2} placeholder="Ex: Escala noturna, considerar adicional noturno." />
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition"
          disabled={isSubmitting}
        >
          Salvar Escala
        </Button>
      </div>
    </form>
  );
}
