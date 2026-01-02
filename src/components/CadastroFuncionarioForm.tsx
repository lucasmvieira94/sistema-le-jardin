
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Key } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent } from "@/components/ui/card";
import { validateCPF, validateEmail, sanitizeString } from "@/utils/validation";
import NomeInput from "./cadastro-funcionario/NomeInput";
import EmailInput from "./cadastro-funcionario/EmailInput";
import CpfInput from "./cadastro-funcionario/CpfInput";
import DataInput from "./cadastro-funcionario/DataInput";
import FuncaoInput from "./cadastro-funcionario/FuncaoInput";
import EscalaSelect from "./cadastro-funcionario/EscalaSelect";
import RegistraPontoSwitch from "./cadastro-funcionario/RegistraPontoSwitch";
import TelefoneInput from "./cadastro-funcionario/TelefoneInput";

type Escala = {
  id: number;
  nome: string;
  jornada_trabalho: string;
  entrada: string;
  saida: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
  observacoes?: string;
};

type FormData = {
  nome_completo: string;
  email: string;
  telefone: string;
  cpf: string;
  data_nascimento: string;
  data_admissao: string;
  data_inicio_vigencia: string;
  funcao: string;
  escala_id: string;
  registra_ponto: boolean;
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
      telefone: funcionarioData.telefone || '',
      cpf: funcionarioData.cpf || '',
      data_nascimento: funcionarioData.data_nascimento || '',
      data_admissao: funcionarioData.data_admissao || '',
      data_inicio_vigencia: funcionarioData.data_inicio_vigencia || '',
      funcao: funcionarioData.funcao || '',
      escala_id: funcionarioData.escala_id?.toString() || '',
      registra_ponto: funcionarioData.registra_ponto ?? true,
    } : {
      registra_ponto: true,
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const { isAdmin } = useUserRole();
  const { logEvent } = useAuditLog();

  // Função para reenviar código via SMS
  async function reenviarCodigo() {
    if (!funcionarioData?.codigo_4_digitos || !funcionarioData?.telefone) {
      toast({ variant: "destructive", title: "Dados incompletos", description: "Telefone ou código não disponível" });
      return;
    }

    setIsResending(true);
    try {
      const telefoneNumeros = funcionarioData.telefone.replace(/\D/g, '');
      const telefoneFormatado = '+55' + telefoneNumeros;

      const resp = await fetch(
        "https://kvjgmqicictxxfnvhuwl.functions.supabase.co/enviar-codigo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: telefoneFormatado,
            nome: funcionarioData.nome_completo,
            codigo: funcionarioData.codigo_4_digitos,
          }),
        }
      );

      if (resp.ok) {
        toast({ title: "Código reenviado!", description: "O código foi enviado por SMS para o telefone cadastrado." });
      } else {
        const errorData = await resp.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Falha ao reenviar SMS", description: errorData.error || "Tente novamente" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao reenviar código", description: err?.message });
    }
    setIsResending(false);
  }

  useEffect(() => {
    async function fetchEscalas() {
      const { data, error } = await supabase.from("escalas").select("*");
      if (!error) setEscalas(data || []);
    }
    fetchEscalas();
  }, []);

  // Limpar valores de escala quando registra_ponto for desabilitado
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "registra_ponto" && !value.registra_ponto) {
        form.setValue("escala_id", "");
        form.setValue("data_inicio_vigencia", "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

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

      // Validar escala apenas se o funcionário registra ponto
      if (values.registra_ponto && (!values.escala_id || values.escala_id === "")) {
        toast({ variant: "destructive", title: "Escala é obrigatória para funcionários que registram ponto" });
        setIsSubmitting(false);
        return;
      }

      // Validar telefone
      const telefoneNumeros = values.telefone?.replace(/\D/g, '') || '';
      if (!telefoneNumeros || telefoneNumeros.length < 10) {
        toast({ variant: "destructive", title: "Telefone inválido", description: "Informe um telefone válido com DDD" });
        setIsSubmitting(false);
        return;
      }

      // Sanitize string inputs
      const sanitizedValues = {
        ...values,
        nome_completo: sanitizeString(values.nome_completo),
        email: sanitizeString(values.email),
        telefone: values.telefone,
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
          nome_completo: sanitizedValues.nome_completo,
          email: sanitizedValues.email,
          telefone: sanitizedValues.telefone,
          cpf: sanitizedValues.cpf,
          data_nascimento: sanitizedValues.data_nascimento,
          data_admissao: sanitizedValues.data_admissao,
          funcao: sanitizedValues.funcao,
          registra_ponto: sanitizedValues.registra_ponto,
          escala_id: sanitizedValues.registra_ponto ? Number(sanitizedValues.escala_id) : null,
          data_inicio_vigencia: sanitizedValues.registra_ponto ? sanitizedValues.data_inicio_vigencia : null,
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
          nome_completo: sanitizedValues.nome_completo,
          email: sanitizedValues.email,
          telefone: sanitizedValues.telefone,
          cpf: sanitizedValues.cpf,
          data_nascimento: sanitizedValues.data_nascimento,
          data_admissao: sanitizedValues.data_admissao,
          funcao: sanitizedValues.funcao,
          registra_ponto: sanitizedValues.registra_ponto,
          escala_id: sanitizedValues.registra_ponto ? Number(sanitizedValues.escala_id) : null,
          data_inicio_vigencia: sanitizedValues.registra_ponto ? sanitizedValues.data_inicio_vigencia : null,
          codigo_4_digitos: codigo,
        };

        const { error } = await supabase.from("funcionarios").insert([newFuncionario]);
        if (error) {
          throw error;
        }

        // Log audit event
        await logEvent('funcionarios', 'INSERT', null, newFuncionario);

        // Enviar código via SMS usando Twilio
        const telefoneFormatado = '+55' + telefoneNumeros;
        const resp = await fetch(
          "https://kvjgmqicictxxfnvhuwl.functions.supabase.co/enviar-codigo",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telefone: telefoneFormatado,
              nome: sanitizedValues.nome_completo,
              codigo,
            }),
          }
        );
        if (resp.ok) {
          toast({ title: "Funcionário cadastrado!", description: "O código de acesso foi enviado por SMS." });
          form.reset();
        } else {
          toast({ variant: "destructive", title: "Funcionário cadastrado mas falha ao enviar SMS." });
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
        {/* Exibir código de 4 dígitos quando editando */}
        {isEditing && funcionarioData?.codigo_4_digitos && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Código de Acesso</p>
                    <p className="text-2xl font-bold tracking-widest text-primary">
                      {funcionarioData.codigo_4_digitos}
                    </p>
                  </div>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={reenviarCodigo}
                  disabled={isResending}
                  className="shrink-0"
                >
                  {isResending ? (
                    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Enviando...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Reenviar SMS</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <NomeInput control={form.control} />
        <div className="flex flex-col md:flex-row gap-4">
          <EmailInput control={form.control} />
          <TelefoneInput control={form.control} />
        </div>
        <CpfInput control={form.control} />
        <div className="flex flex-col md:flex-row gap-4">
          <DataInput control={form.control} name="data_nascimento" label="Data de Nascimento" />
          <DataInput control={form.control} name="data_admissao" label="Data de Admissão" />
        </div>
        <FuncaoInput control={form.control} />
        <RegistraPontoSwitch control={form.control} />
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Escala de Trabalho</h3>
          {form.watch("registra_ponto") && (
            <>
              <EscalaSelect control={form.control} escalas={escalas} required={true} />
              <DataInput 
                control={form.control} 
                name="data_inicio_vigencia" 
                label="Data de Início da Vigência da Escala"
              />
            </>
          )}
          {!form.watch("registra_ponto") && (
            <p className="text-sm text-muted-foreground">
              Este funcionário não registra ponto e não precisa de escala de trabalho.
            </p>
          )}
        </div>
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
