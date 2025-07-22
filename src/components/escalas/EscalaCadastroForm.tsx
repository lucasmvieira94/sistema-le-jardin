import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import EscalaNomeField from "./EscalaNomeField";
import TipoJornadaSelect from "./TipoJornadaSelect";
import HorariosFields from "./HorariosFields";
import IntervaloFields from "./IntervaloFields";
import ObservacoesField from "./ObservacoesField";

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
  observacoes: z.string().optional(),
})
/** 
 * Não mais impede que entrada < saída.
 * Com essa atualização, se "saida" for menor que "entrada"
 * trata-se de uma escala noturna/virada de dia.
 */
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

// Adicione a tipagem das props:
type Props = {
  onCreated?: () => void;
  onCancel?: () => void;
};

export default function EscalaCadastroForm({ onCreated, onCancel }: Props) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<EscalaCadastro>({
    resolver: zodResolver(escalaSchema),
    defaultValues: {}
  });

  const onSubmit = async (data: EscalaCadastro) => {
    // Enviar para o Supabase incluindo os campos de intervalo
    const { error } = await supabase.from("escalas").insert({
      nome: data.nomeEscala,
      entrada: data.entrada,
      saida: data.saida,
      intervalo_inicio: data.intervaloInicio || null,
      intervalo_fim: data.intervaloFim || null,
      dias_semana: diasSemanaTodos, // por padrão, todos os dias
    });

    if (error) {
      toast({
        title: "Erro ao salvar escala",
        description: "Ocorreu um erro ao salvar a escala. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Escala cadastrada!",
      description: "Sua escala foi salva com sucesso.",
      duration: 4000,
    });
    reset();
    if (onCreated) onCreated();
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl p-6 shadow-lg flex flex-col gap-5 mt-4 md:mt-0 animate-fade-in"
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold text-green-700 mb-3">Nova Escala de Trabalho</h2>
      <EscalaNomeField register={register} errors={errors} />
      <TipoJornadaSelect control={control} errors={errors} />
      <HorariosFields register={register} errors={errors} />
      <IntervaloFields register={register} errors={errors} />
      <ObservacoesField register={register} />
      <div className="pt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="px-6 py-2 rounded-lg transition"
        >
          Cancelar
        </Button>
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
