import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, FileText, Loader2 } from "lucide-react";

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

export default function ContratoTemporarioPublico() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadSolicitacao();
  }, [token]);

  const loadSolicitacao = async () => {
    setLoading(true);
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
    setForm((prev) => ({ ...prev, [field]: value }));
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Link inválido</h2>
            <p className="text-muted-foreground">Este link de contrato temporário não foi encontrado ou já expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-lg font-semibold mb-2">Dados enviados!</h2>
            <p className="text-muted-foreground">
              {status === "aguardando_empresa"
                ? "Seus dados foram recebidos. A empresa finalizará o contrato com os valores e período."
                : status === "contrato_gerado"
                ? "O contrato já foi gerado pela empresa."
                : "Esta solicitação já foi processada."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">LE JARDIN RESIDENCIAL SÊNIOR</h1>
          <p className="text-muted-foreground mt-1">Cadastro para Contrato de Curta Temporada</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Contratante */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Contratante</CardTitle>
              <CardDescription>Responsável pela contratação do serviço</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input value={form.contratante_nome} onChange={(e) => handleChange("contratante_nome", e.target.value)} required />
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input value={form.contratante_cpf} onChange={(e) => handleChange("contratante_cpf", e.target.value)} placeholder="000.000.000-00" required />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input value={form.contratante_rg} onChange={(e) => handleChange("contratante_rg", e.target.value)} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.contratante_telefone} onChange={(e) => handleChange("contratante_telefone", e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.contratante_email} onChange={(e) => handleChange("contratante_email", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.contratante_endereco} onChange={(e) => handleChange("contratante_endereco", e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.contratante_cidade} onChange={(e) => handleChange("contratante_cidade", e.target.value)} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input value={form.contratante_estado} onChange={(e) => handleChange("contratante_estado", e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.contratante_cep} onChange={(e) => handleChange("contratante_cep", e.target.value)} placeholder="00000-000" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Residente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Residente</CardTitle>
              <CardDescription>Pessoa que receberá os cuidados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input value={form.residente_nome} onChange={(e) => handleChange("residente_nome", e.target.value)} required />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={form.residente_cpf} onChange={(e) => handleChange("residente_cpf", e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Data de Nascimento *</Label>
                  <Input type="date" value={form.residente_data_nascimento} onChange={(e) => handleChange("residente_data_nascimento", e.target.value)} required />
                </div>
              </div>
              <div>
                <Label>Observações / Condições Especiais</Label>
                <Textarea value={form.residente_observacoes} onChange={(e) => handleChange("residente_observacoes", e.target.value)} placeholder="Informe condições médicas, medicamentos em uso, necessidades especiais, etc." rows={3} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Enviar Dados"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Seus dados serão utilizados exclusivamente para a formalização do contrato de prestação de serviços.
          </p>
        </form>
      </div>
    </div>
  );
}
