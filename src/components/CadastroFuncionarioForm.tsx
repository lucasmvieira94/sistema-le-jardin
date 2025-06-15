
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectItem, SelectContent, SelectLabel, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Escala = {
  id: number;
  nome: string;
  entrada: string;
  saida: string;
  dias_semana: string[];
};

type FormData = {
  nome_completo: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  data_admissao: string;
  data_inicio_vigencia: string;
  funcao: string;
  escala_id: string;
};

function gerarCodigoAleatorio() {
  // Gera um número de 4 dígitos entre 1000-9999
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function CadastroFuncionarioForm() {
  const form = useForm<FormData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);

  useEffect(() => {
    async function fetchEscalas() {
      const { data, error } = await supabase.from("escalas").select("*");
      if (!error) setEscalas(data || []);
    }
    fetchEscalas();
  }, []);

  async function geraCodigoUnico() {
    // Garante código não repetido na tabela
    let codigo;
    let existe = true;
    do {
      codigo = gerarCodigoAleatorio();
      const { data } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("codigo_4_digitos", codigo)
        .maybeSingle();
      existe = !!data;
    } while (existe);
    return codigo;
  }

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      // Verifica se já existe funcionário com cpf ou email
      const { data: existeCpf } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("cpf", values.cpf)
        .maybeSingle();
      if (existeCpf) {
        toast({ variant: "destructive", title: "CPF já cadastrado" });
        setIsSubmitting(false);
        return;
      }
      const { data: existeEmail } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("email", values.email)
        .maybeSingle();
      if (existeEmail) {
        toast({ variant: "destructive", title: "Email já cadastrado" });
        setIsSubmitting(false);
        return;
      }

      const codigo = await geraCodigoUnico();

      const { error } = await supabase.from("funcionarios").insert([
        {
          ...values,
          escala_id: Number(values.escala_id),
          codigo_4_digitos: codigo,
        },
      ]);
      if (error) {
        throw error;
      }

      // Chama edge function para enviar email
      const resp = await fetch(
        "https://kvjgmqicictxxfnvhuwl.functions.supabase.co/enviar-codigo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            nome: values.nome_completo,
            codigo,
          }),
        }
      );
      if (resp.ok) {
        toast({ title: "Funcionário cadastrado!", description: "O código de acesso foi enviado por email." });
        form.reset();
      } else {
        toast({ variant: "destructive", title: "Funcionário cadastrado mas falha ao enviar email." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: err?.message });
    }
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="nome_completo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="Nome Completo" {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col md:flex-row gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input placeholder="999.999.999-99" maxLength={14} minLength={11} {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <FormField
            control={form.control}
            name="data_nascimento"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Data de Nascimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data_admissao"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Data de Admissão</FormLabel>
                <FormControl>
                  <Input type="date" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <FormField
            control={form.control}
            name="data_inicio_vigencia"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Início da Vigência</FormLabel>
                <FormControl>
                  <Input type="date" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="funcao"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Função</FormLabel>
                <FormControl>
                  <Input placeholder="Cargo/Função" {...field} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="escala_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escala</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                defaultValue={field.value}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma escala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectLabel>Escalas disponíveis</SelectLabel>
                  {escalas.map((escala) => (
                    <SelectItem key={escala.id} value={String(escala.id)}>
                      {escala.nome} ({escala.entrada} às {escala.saida})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Cadastrar Funcionário"}
        </Button>
      </form>
    </Form>
  );
}
