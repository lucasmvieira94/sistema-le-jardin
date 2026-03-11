import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, MessageSquareHeart, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import careLogo from "@/assets/logo-senex-care-new.png";

const opcoesLikert = [
  { value: "concordo_totalmente", label: "Concordo totalmente" },
  { value: "concordo", label: "Concordo" },
  { value: "neutro", label: "Neutro" },
  { value: "discordo", label: "Discordo" },
  { value: "discordo_totalmente", label: "Discordo totalmente" },
];

const opcoesSatisfacao = [
  { value: "muito_satisfeito", label: "Muito satisfeito" },
  { value: "satisfeito", label: "Satisfeito" },
  { value: "neutro", label: "Neutro" },
  { value: "insatisfeito", label: "Insatisfeito" },
  { value: "nao_utilizo", label: "Não utilizo" },
];

const opcoesDificuldade = [
  { value: "nenhuma", label: "Nenhuma dificuldade" },
  { value: "pouca", label: "Pouca dificuldade" },
  { value: "moderada", label: "Dificuldade moderada" },
  { value: "muita", label: "Muita dificuldade" },
];

export default function FeedbackSistema() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    facilidade_uso: "",
    processos_manuais: "",
    funcionalidades_desejadas: "",
    dificuldade_ferramentas_digitais: "",
    melhorias_sugeridas: "",
    satisfacao_registro_ponto: "",
    satisfacao_prontuario: "",
    satisfacao_controle_temperatura: "",
    satisfacao_controle_fraldas: "",
    satisfacao_escala: "",
    sugestoes: "",
    criticas: "",
    elogios: "",
    observacoes_gerais: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.facilidade_uso || !form.dificuldade_ferramentas_digitais) {
      toast.error("Por favor, responda as perguntas obrigatórias.");
      return;
    }

    if (!funcionarioId) {
      toast.error("Funcionário não identificado.");
      return;
    }

    setEnviando(true);
    try {
      const { error } = await supabase.from("feedback_sistema" as any).insert({
        funcionario_id: funcionarioId,
        funcionario_nome: decodeURIComponent(funcionarioNome),
        ...form,
      } as any);

      if (error) throw error;

      setEnviado(true);
      toast.success("Feedback enviado com sucesso! Obrigado pela sua contribuição.");
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      toast.error("Erro ao enviar feedback. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Acesso não autorizado. Utilize o código de funcionário.</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold text-green-800">Obrigado pelo seu feedback!</h2>
            <p className="text-muted-foreground">
              Sua opinião é muito importante para melhorarmos o sistema SENEXCARE.
            </p>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={() => navigate(`/?funcionario_id=${funcionarioId}`)}
            >
              Voltar ao Menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <img src={careLogo} alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-green-800">
                  Feedback do Sistema
                </h1>
                <p className="text-sm text-muted-foreground">
                  {decodeURIComponent(funcionarioNome)}
                </p>
              </div>
            </div>
            <MessageSquareHeart className="w-8 h-8 text-green-600 shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground">
            Sua opinião é fundamental para melhorar o SENEXCARE. Responda com sinceridade — o questionário é confidencial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pergunta 1 - Facilidade de uso */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                1. Você considera o sistema fácil de utilizar? <span className="text-red-500">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={form.facilidade_uso}
                onValueChange={(v) => updateField("facilidade_uso", v)}
                className="space-y-2"
              >
                {opcoesLikert.map((op) => (
                  <div key={op.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={op.value} id={`facilidade_${op.value}`} />
                    <Label htmlFor={`facilidade_${op.value}`} className="cursor-pointer text-sm">
                      {op.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Pergunta 2 - Processos manuais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                2. Quais processos ainda são realizados manualmente na instituição?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Descreva os processos que você ainda realiza de forma manual..."
                value={form.processos_manuais}
                onChange={(e) => updateField("processos_manuais", e.target.value)}
                className="min-h-[80px]"
                maxLength={1000}
              />
            </CardContent>
          </Card>

          {/* Pergunta 3 - Funcionalidades desejadas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                3. Quais funcionalidades poderiam facilitar sua rotina de trabalho?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Descreva funcionalidades que você gostaria de ter no sistema..."
                value={form.funcionalidades_desejadas}
                onChange={(e) => updateField("funcionalidades_desejadas", e.target.value)}
                className="min-h-[80px]"
                maxLength={1000}
              />
            </CardContent>
          </Card>

          {/* Pergunta 4 - Dificuldade com ferramentas digitais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                4. Você possui dificuldade em utilizar ferramentas digitais? <span className="text-red-500">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={form.dificuldade_ferramentas_digitais}
                onValueChange={(v) => updateField("dificuldade_ferramentas_digitais", v)}
                className="space-y-2"
              >
                {opcoesDificuldade.map((op) => (
                  <div key={op.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={op.value} id={`dificuldade_${op.value}`} />
                    <Label htmlFor={`dificuldade_${op.value}`} className="cursor-pointer text-sm">
                      {op.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Pergunta 5 - Melhorias sugeridas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                5. Que melhorias você sugere para o sistema SENEXCARE?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Descreva suas sugestões de melhoria..."
                value={form.melhorias_sugeridas}
                onChange={(e) => updateField("melhorias_sugeridas", e.target.value)}
                className="min-h-[80px]"
                maxLength={1000}
              />
            </CardContent>
          </Card>

          {/* Satisfação por funcionalidade */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                6. Qual sua satisfação com as seguintes funcionalidades?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { field: "satisfacao_registro_ponto", label: "Registro de Ponto" },
                { field: "satisfacao_prontuario", label: "Prontuário Eletrônico" },
                { field: "satisfacao_controle_temperatura", label: "Controle de Temperatura" },
                { field: "satisfacao_controle_fraldas", label: "Controle de Fraldas" },
                { field: "satisfacao_escala", label: "Consulta de Escala" },
              ].map(({ field, label }) => (
                <div key={field}>
                  <Label className="font-medium text-sm mb-2 block">{label}</Label>
                  <RadioGroup
                    value={(form as any)[field]}
                    onValueChange={(v) => updateField(field, v)}
                    className="flex flex-wrap gap-x-4 gap-y-1"
                  >
                    {opcoesSatisfacao.map((op) => (
                      <div key={op.value} className="flex items-center space-x-1">
                        <RadioGroupItem value={op.value} id={`${field}_${op.value}`} />
                        <Label htmlFor={`${field}_${op.value}`} className="cursor-pointer text-xs sm:text-sm">
                          {op.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sugestões, Críticas e Elogios */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                7. Espaço aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-medium text-sm mb-1 block">💡 Sugestões</Label>
                <Textarea
                  placeholder="Suas sugestões para o sistema..."
                  value={form.sugestoes}
                  onChange={(e) => updateField("sugestoes", e.target.value)}
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="font-medium text-sm mb-1 block">⚠️ Críticas</Label>
                <Textarea
                  placeholder="Pontos que precisam melhorar..."
                  value={form.criticas}
                  onChange={(e) => updateField("criticas", e.target.value)}
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="font-medium text-sm mb-1 block">⭐ Elogios</Label>
                <Textarea
                  placeholder="O que você mais gosta no sistema..."
                  value={form.elogios}
                  onChange={(e) => updateField("elogios", e.target.value)}
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="font-medium text-sm mb-1 block">📝 Observações gerais</Label>
                <Textarea
                  placeholder="Qualquer outro comentário..."
                  value={form.observacoes_gerais}
                  onChange={(e) => updateField("observacoes_gerais", e.target.value)}
                  className="min-h-[60px]"
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão de envio */}
          <div className="pb-8">
            <Button
              type="submit"
              disabled={enviando}
              className="w-full bg-green-700 hover:bg-green-800 py-3 text-base"
            >
              <Send className="w-4 h-4 mr-2" />
              {enviando ? "Enviando..." : "Enviar Feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
