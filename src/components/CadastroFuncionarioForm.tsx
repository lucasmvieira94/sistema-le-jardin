
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";
import { validateCPF, validateEmail, sanitizeString } from "@/utils/validation";
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

interface Props {
  funcionarioData?: any;
  onSuccess?: (data: any) => void;
  isEditing?: boolean;
}

function gerarCodigoAleatorio() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function CadastroFuncionarioForm({ funcionarioData, onSuccess, isEditing = false }: Props) {
  const form = useForm<FormData>({
    defaultValues: funcionarioData ? {
      nome_completo: funcionarioData.nome_completo || '',
      email: funcionarioData.email || '',
      cpf: funcionarioData.cpf || '',
      data_nascimento: funcionarioData.data_nascimento || '',
      data_admissao: funcionarioData.data_admissao || '',
      data_inicio_vigencia: funcionarioData.data_inicio_vigencia || '',
      funcao: funcionarioData.funcao || '',
      escala_id: funcionarioData.escala_id?.toString() || '',
    } : undefined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const { isAdmin } = useUserRole();
  const { logEvent } = useAuditLog();

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
    if (!isAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Acesso negado",
        description: `Apenas administradores podem ${isEditing ? 'editar' : 'cadastrar'} funcionários` 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate and sanitize inputs
      if (!validateCPF(values.cpf)) {
        toast({ variant: "destructive", title: "CPF inválido" });
        setIsSubmitting(false);
        return;
      }

      if (!validateEmail(values.email)) {
        toast({ variant: "destructive", title: "Email inválido" });
        setIsSubmitting(false);
        return;
      }

      // Sanitize string inputs
      const sanitizedValues = {
        ...values,
        nome_completo: sanitizeString(values.nome_completo),
        email: sanitizeString(values.email),
        funcao: sanitizeString(values.funcao)
      };

      // Check for duplicates only if not editing or if values changed
      if (!isEditing || (funcionarioData && sanitizedValues.cpf !== funcionarioData.cpf)) {
        const { data: existeCpf } = await supabase
          .from("funcionarios")
          .select("id")
          .eq("cpf", sanitizedValues.cpf)
          .maybeSingle();
        if (existeCpf) {
          toast({ variant: "destructive", title: "CPF já cadastrado" });
          setIsSubmitting(false);
          return;
        }
      }

      if (!isEditing || (funcionarioData && sanitizedValues.email !== funcionarioData.email)) {
        const { data: existeEmail } = await supabase
          .from("funcionarios")
          .select("id")
          .eq("email", sanitizedValues.email)
          .maybeSingle();
        if (existeEmail) {
          toast({ variant: "destructive", title: "Email já cadastrado" });
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditing && funcionarioData) {
        // Update existing funcionario
        const updateData = {
          ...sanitizedValues,
          escala_id: Number(sanitizedValues.escala_id),
        };

        const { error } = await supabase
          .from("funcionarios")
          .update(updateData)
          .eq("id", funcionarioData.id);

        if (error) {
          throw error;
        }

        if (onSuccess) {
          onSuccess(updateData);
        } else {
          toast({ title: "Funcionário atualizado com sucesso!" });
        }
      } else {
        // Create new funcionario
        const codigo = await geraCodigoUnico();

        const newFuncionario = {
          ...sanitizedValues,
          escala_id: Number(sanitizedValues.escala_id),
          codigo_4_digitos: codigo,
        };

        const { error } = await supabase.from("funcionarios").insert([newFuncionario]);
        if (error) {
          throw error;
        }

        // Log audit event
        await logEvent('funcionarios', 'INSERT', null, newFuncionario);

        const resp = await fetch(
          "https://kvjgmqicictxxfnvhuwl.functions.supabase.co/enviar-codigo",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: sanitizedValues.email,
              nome: sanitizedValues.nome_completo,
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
      }
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'}`, 
        description: err?.message 
      });
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
          {isSubmitting ? (
            <><Loader2 className="animate-spin mr-2 h-4 w-4" /> {isEditing ? 'Atualizando...' : 'Cadastrando...'}</>
          ) : (
            isEditing ? 'Atualizar Funcionário' : 'Cadastrar Funcionário'
          )}
        </Button>
      </form>
    </Form>
  );
}
