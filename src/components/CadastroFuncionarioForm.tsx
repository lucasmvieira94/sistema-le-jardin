
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import NomeInput from "./cadastro-funcionario/NomeInput";
import EmailInput from "./cadastro-funcionario/EmailInput";
import CpfInput from "./cadastro-funcionario/CpfInput";
import DataInput from "./cadastro-funcionario/DataInput";
import FuncaoInput from "./cadastro-funcionario/FuncaoInput";
import EscalaSelect from "./cadastro-funcionario/EscalaSelect";

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
        <NomeInput control={form.control} />
        <div className="flex flex-col md:flex-row gap-4">
          <EmailInput control={form.control} />
          <CpfInput control={form.control} />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <DataInput control={form.control} name="data_nascimento" label="Data de Nascimento" />
          <DataInput control={form.control} name="data_admissao" label="Data de Admissão" />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <DataInput control={form.control} name="data_inicio_vigencia" label="Início da Vigência" />
          <FuncaoInput control={form.control} />
        </div>
        <EscalaSelect control={form.control} escalas={escalas} />
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Cadastrar Funcionário"}
        </Button>
      </form>
    </Form>
  );
}
