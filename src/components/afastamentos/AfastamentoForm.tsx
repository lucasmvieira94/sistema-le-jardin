
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Funcionario {
  id: string;
  nome_completo: string;
}

interface TipoAfastamento {
  id: number;
  codigo: string;
  descricao: string;
  remunerado: boolean;
}

interface FormData {
  funcionario_id: string;
  tipo_afastamento_id: string;
  tipo_periodo: "horas" | "dias";
  data_inicio: string;
  hora_inicio?: string;
  quantidade_horas?: number;
  quantidade_dias?: number;
  observacoes?: string;
}

interface AfastamentoFormProps {
  onAfastamentoAdded?: () => void;
}

export default function AfastamentoForm({ onAfastamentoAdded }: AfastamentoFormProps) {
  const form = useForm<FormData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [tiposAfastamento, setTiposAfastamento] = useState<TipoAfastamento[]>([]);
  const [tipoPeriodo, setTipoPeriodo] = useState<"horas" | "dias">("dias");

  useEffect(() => {
    fetchFuncionarios();
    fetchTiposAfastamento();
  }, []);

  async function fetchFuncionarios() {
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome_completo")
      .eq("ativo", true)
      .order("nome_completo");
    
    if (!error && data) {
      setFuncionarios(data);
    }
  }

  async function fetchTiposAfastamento() {
    const { data, error } = await supabase
      .from("tipos_afastamento")
      .select("*")
      .order("categoria, descricao");
    
    if (!error && data) {
      setTiposAfastamento(data);
    }
  }

  function calcularDataFim(dataInicio: string, quantidadeDias: number) {
    const data = new Date(dataInicio);
    data.setDate(data.getDate() + quantidadeDias - 1);
    return data.toISOString().split('T')[0];
  }

  function calcularHoraFim(horaInicio: string, quantidadeHoras: number) {
    const [horas, minutos] = horaInicio.split(':').map(Number);
    const totalMinutos = horas * 60 + minutos + quantidadeHoras * 60;
    const novasHoras = Math.floor(totalMinutos / 60);
    const novosMinutos = totalMinutos % 60;
    return `${novasHoras.toString().padStart(2, '0')}:${novosMinutos.toString().padStart(2, '0')}`;
  }

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    
    try {
      let dataFim = null;
      let horaFim = null;

      if (values.tipo_periodo === "dias" && values.quantidade_dias) {
        dataFim = calcularDataFim(values.data_inicio, values.quantidade_dias);
      } else if (values.tipo_periodo === "horas" && values.hora_inicio && values.quantidade_horas) {
        horaFim = calcularHoraFim(values.hora_inicio, values.quantidade_horas);
      }

      const { error } = await supabase.from("afastamentos").insert([
        {
          funcionario_id: values.funcionario_id,
          tipo_afastamento_id: Number(values.tipo_afastamento_id),
          tipo_periodo: values.tipo_periodo,
          data_inicio: values.data_inicio,
          data_fim: dataFim,
          hora_inicio: values.hora_inicio || null,
          hora_fim: horaFim,
          quantidade_horas: values.quantidade_horas || null,
          quantidade_dias: values.quantidade_dias || null,
          observacoes: values.observacoes || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Afastamento registrado!",
        description: "O afastamento foi registrado com sucesso e já está disponível na folha de ponto.",
      });

      form.reset();
      setTipoPeriodo("dias");
      onAfastamentoAdded?.();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao registrar afastamento",
        description: err?.message,
      });
    }
    
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="funcionario_id"
          rules={{ required: "Selecione um funcionário" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Funcionário</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {funcionarios.map((funcionario) => (
                    <SelectItem key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipo_afastamento_id"
          rules={{ required: "Selecione o tipo de afastamento" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Afastamento</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de afastamento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tiposAfastamento.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id.toString()}>
                      {tipo.descricao} {tipo.remunerado ? "(Remunerado)" : "(Não remunerado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipo_periodo"
          rules={{ required: "Selecione o tipo de período" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Período</FormLabel>
              <Select onValueChange={(value) => {
                field.onChange(value);
                setTipoPeriodo(value as "horas" | "dias");
              }} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de período" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dias">Dias</SelectItem>
                  <SelectItem value="horas">Horas</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="data_inicio"
          rules={{ required: "Informe a data de início" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Início</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {tipoPeriodo === "horas" && (
          <>
            <FormField
              control={form.control}
              name="hora_inicio"
              rules={{ required: "Informe a hora de início" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de Início</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantidade_horas"
              rules={{ required: "Informe a quantidade de horas", min: { value: 1, message: "Mínimo 1 hora" } }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Horas</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {tipoPeriodo === "dias" && (
          <FormField
            control={form.control}
            name="quantidade_dias"
            rules={{ required: "Informe a quantidade de dias", min: { value: 1, message: "Mínimo 1 dia" } }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade de Dias</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Observações adicionais (opcional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Registrar Afastamento
        </Button>
      </form>
    </Form>
  );
}
