import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, FileText, Loader2, AlertTriangle, User, Home } from "lucide-react";

interface FormData {
  contratante_nome: string;
  contratante_cpf: string;
  contratante_rg: string;
  contratante_endereco: string;
  contratante_cidade: string;
  contratante_estado: string;
  contratante_cep: string;
  contratante_telefone: string;
  contratante_email: string;
  residente_nome: string;
  residente_cpf: string;
  residente_data_nascimento: string;
  residente_observacoes: string;
}

const initialForm: FormData = {
  contratante_nome: "",
  contratante_cpf: "",
  contratante_rg: "",
  contratante_endereco: "",
  contratante_cidade: "",
  contratante_estado: "",
  contratante_cep: "",
  contratante_telefone: "",
  contratante_email: "",
  residente_nome: "",
  residente_cpf: "",
  residente_data_nascimento: "",
  residente_observacoes: "",
};

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function ContratoTemporarioPublico() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [empresaNome, setEmpresaNome] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);

    // Load company info (public access)
    const { data: empresaData } = await supabase
      .from("configuracoes_empresa")
      .select("nome_empresa")
      .limit(1)
      .single();

    if (empresaData) {
      setEmpresaNome(empresaData.nome_empresa);
    }

    // Load solicitation
    const { data, error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const d = data as any;
    setStatus(d.status);

    if (d.status !== "aguardando_contratante") {
      setSubmitted(true);
    } else if (d.contratante_nome) {
      setForm({
        contratante_nome: d.contratante_nome || "",
        contratante_cpf: d.contratante_cpf || "",
        contratante_rg: d.contratante_rg || "",
        contratante_endereco: d.contratante_endereco || "",
        contratante_cidade: d.contratante_cidade || "",
        contratante_estado: d.contratante_estado || "",
        contratante_cep: d.contratante_cep || "",
        contratante_telefone: d.contratante_telefone || "",
        contratante_email: d.contratante_email || "",
        residente_nome: d.residente_nome || "",
        residente_cpf: d.residente_cpf || "",
        residente_data_nascimento: d.residente_data_nascimento || "",
        residente_observacoes: d.residente_observacoes || "",
      });
    }
    setLoading(false);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    if (field === "contratante_cpf" || field === "residente_cpf") {
      setForm((prev) => ({ ...prev, [field]: formatCPF(value) }));
    } else if (field === "contratante_telefone") {
      setForm((prev) => ({ ...prev, [field]: formatPhone(value) }));
    } else if (field === "contratante_cep") {
      setForm((prev) => ({ ...prev, [field]: formatCEP(value) }));
    } else if (field === "contratante_estado") {
      setForm((prev) => ({ ...prev, [field]: value.toUpperCase().slice(0, 2) }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.contratante_nome || !form.contratante_cpf || !form.residente_nome || !form.residente_data_nascimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e CPF do contratante, nome e data de nascimento do residente.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .update({
        ...form,
        status: "aguardando_empresa",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("token", token);

    if (error) {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } else {
      setSubmitted(true);
      toast({ title: "Dados enviados com sucesso!", description: "A empresa será notificada para finalizar o contrato." });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">Link inválido</h2>
            <p className="text-muted-foreground">
              Este link de contrato temporário não foi encontrado ou já expirou.
              Entre em contato com a empresa para obter um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">
              {status === "aguardando_empresa" ? "Dados enviados com sucesso!" : "Solicitação processada"}
            </h2>
            <p className="text-muted-foreground">
              {status === "aguardando_empresa"
                ? "Seus dados foram recebidos. A empresa finalizará o contrato com os valores e período de hospedagem."
                : status === "contrato_gerado"
                ? "O contrato já foi gerado pela empresa. Você será contatado para assinatura."
                : "Esta solicitação já foi processada."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {empresaNome || "Residencial Sênior"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Formulário de Cadastro — Contrato de Curta Temporada
          </p>
          <div className="w-16 h-0.5 bg-primary/30 mx-auto mt-4" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Contratante */}
          <Card className="shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dados do Contratante</CardTitle>
                  <CardDescription>Responsável pela contratação do serviço</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome Completo <span className="text-destructive">*</span></Label>
                  <Input 
                    value={form.contratante_nome} 
                    onChange={(e) => handleChange("contratante_nome", e.target.value)} 
                    placeholder="Nome completo"
                    required 
                  />
                </div>
                <div>
                  <Label>CPF <span className="text-destructive">*</span></Label>
                  <Input 
                    value={form.contratante_cpf} 
                    onChange={(e) => handleChange("contratante_cpf", e.target.value)} 
                    placeholder="000.000.000-00" 
                    required 
                  />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input 
                    value={form.contratante_rg} 
                    onChange={(e) => handleChange("contratante_rg", e.target.value)} 
                    placeholder="Número do RG"
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input 
                    value={form.contratante_telefone} 
                    onChange={(e) => handleChange("contratante_telefone", e.target.value)} 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    value={form.contratante_email} 
                    onChange={(e) => handleChange("contratante_email", e.target.value)} 
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input 
                    value={form.contratante_endereco} 
                    onChange={(e) => handleChange("contratante_endereco", e.target.value)} 
                    placeholder="Rua, número, complemento"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input 
                    value={form.contratante_cidade} 
                    onChange={(e) => handleChange("contratante_cidade", e.target.value)} 
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input 
                    value={form.contratante_estado} 
                    onChange={(e) => handleChange("contratante_estado", e.target.value)} 
                    placeholder="UF"
                    maxLength={2} 
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input 
                    value={form.contratante_cep} 
                    onChange={(e) => handleChange("contratante_cep", e.target.value)} 
                    placeholder="00000-000" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Residente */}
          <Card className="shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dados do Residente</CardTitle>
                  <CardDescription>Pessoa que receberá os cuidados durante a hospedagem</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome Completo <span className="text-destructive">*</span></Label>
                  <Input 
                    value={form.residente_nome} 
                    onChange={(e) => handleChange("residente_nome", e.target.value)} 
                    placeholder="Nome completo do residente"
                    required 
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input 
                    value={form.residente_cpf} 
                    onChange={(e) => handleChange("residente_cpf", e.target.value)} 
                    placeholder="000.000.000-00" 
                  />
                </div>
                <div>
                  <Label>Data de Nascimento <span className="text-destructive">*</span></Label>
                  <Input 
                    type="date" 
                    value={form.residente_data_nascimento} 
                    onChange={(e) => handleChange("residente_data_nascimento", e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div>
                <Label>Observações / Condições Especiais</Label>
                <Textarea 
                  value={form.residente_observacoes} 
                  onChange={(e) => handleChange("residente_observacoes", e.target.value)} 
                  placeholder="Informe condições médicas, medicamentos em uso, necessidades especiais, restrições alimentares, etc." 
                  rows={4} 
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-12 text-base font-semibold" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 
                Enviando dados...
              </>
            ) : (
              "Enviar Dados para a Empresa"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground px-4">
            Seus dados serão utilizados exclusivamente para a formalização do contrato de prestação de serviços
            de hospedagem temporária. Ao enviar, você concorda com o tratamento dos dados para esta finalidade.
          </p>
        </form>
      </div>
    </div>
  );
}
