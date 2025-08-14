import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import EscalaNomeField from "./EscalaNomeField";
import JornadaTrabalhoSelect from "./JornadaTrabalhoSelect";
import HorariosFields from "./HorariosFields";
import IntervaloFields from "./IntervaloFields";
import ObservacoesField from "./ObservacoesField";


const diasSemanaTodos = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

// Schema para escalas como templates reutilizáveis
const escalaSchema = z.object({
  nomeEscala: z.string().min(2, "Nome obrigatório"),
  jornadaTrabalho: z.string().min(1, "Selecione uma jornada de trabalho"),
  entrada: z.string().min(1, "Informe o horário"),
  saida: z.string().min(1, "Informe o horário"),
  intervaloInicio: z.string().optional(),
  intervaloFim: z.string().optional(),
  observacoes: z.string().optional(),
})
.refine((data) => {
  // Validação de intervalo para jornadas que exigem intervalo obrigatório
  const jornadasComIntervaloObrigatorio = [
    "40h_8h_segsex",
    "44h_8h_segsex_4h_sab", 
    "44h_8h48_segsex",
    "6x1",
    "5x1", 
    "5x2",
    "4x2"
  ];
  
  if (jornadasComIntervaloObrigatorio.includes(data.jornadaTrabalho)) {
    return (
      !!data.intervaloInicio &&
      !!data.intervaloFim &&
      data.intervaloFim > data.intervaloInicio &&
      getIntervaloMinutos(data.intervaloInicio, data.intervaloFim) >= 60
    );
  }
  return true;
}, {
  message: "Obrigatório ao menos 1h de intervalo para esta jornada",
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

// Type para escalas como templates
export type EscalaData = {
  id?: number;
  nome: string;
  jornada_trabalho: string;
  entrada: string;
  saida: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  observacoes?: string;
}

// Adicione a tipagem das props:
type Props = {
  escala?: EscalaData;
  onCreated?: () => void;
  onCancel?: () => void;
};

export default function EscalaCadastroForm({ escala, onCreated, onCancel }: Props) {
  const isEditing = !!escala;
  
  const form = useForm<EscalaCadastro>({
    resolver: zodResolver(escalaSchema),
    defaultValues: {
      nomeEscala: escala?.nome || "",
      jornadaTrabalho: escala?.jornada_trabalho || "40h_8h_segsex",
      entrada: escala?.entrada?.slice(0, 5) || "",
      saida: escala?.saida?.slice(0, 5) || "",
      intervaloInicio: escala?.intervalo_inicio?.slice(0, 5) || "",
      intervaloFim: escala?.intervalo_fim?.slice(0, 5) || "",
      observacoes: escala?.observacoes || "",
    }
  });

  const onSubmit = async (data: EscalaCadastro) => {
    const escalaData = {
      nome: data.nomeEscala,
      jornada_trabalho: data.jornadaTrabalho,
      entrada: data.entrada,
      saida: data.saida,
      intervalo_inicio: data.intervaloInicio || null,
      intervalo_fim: data.intervaloFim || null,
      observacoes: data.observacoes || null,
    };

    if (isEditing && escala?.id) {
      const { error } = await supabase
        .from("escalas")
        .update(escalaData)
        .eq("id", escala.id);

      if (error) {
        toast({
          title: "Erro ao atualizar escala",
          description: "Ocorreu um erro ao atualizar a escala. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Escala atualizada!",
        description: "Sua escala foi atualizada com sucesso.",
        duration: 4000,
      });
    } else {
      const { error } = await supabase.from("escalas").insert(escalaData);

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
    }
    
    form.reset();
    if (onCreated) onCreated();
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-white rounded-xl p-6 shadow-lg flex flex-col gap-5 mt-4 md:mt-0 animate-fade-in"
        autoComplete="off"
      >
      <h2 className="text-2xl font-bold text-green-700 mb-3">
        {isEditing ? "Editar Template de Escala" : "Novo Template de Escala"}
      </h2>
      <p className="text-muted-foreground mb-4">
        Crie um template de escala que poderá ser reutilizado por múltiplos funcionários. 
        A data de início da escala será definida individualmente na ficha de cada funcionário.
      </p>
      <EscalaNomeField register={form.register} errors={form.formState.errors} />
      <JornadaTrabalhoSelect control={form.control} errors={form.formState.errors} />
      <HorariosFields register={form.register} errors={form.formState.errors} />
      <IntervaloFields register={form.register} errors={form.formState.errors} />
      <ObservacoesField register={form.register} />
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
          disabled={form.formState.isSubmitting}
        >
          {isEditing ? "Atualizar Escala" : "Salvar Escala"}
        </Button>
      </div>
      </form>
    </Form>
  );
}
