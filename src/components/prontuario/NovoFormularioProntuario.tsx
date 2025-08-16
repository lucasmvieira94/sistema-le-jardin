import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Heart, Pill, Clock, Stethoscope, Smile, AlertTriangle, FileText } from "lucide-react";

interface FormularioData {
  // Identificação do Idoso
  nome_completo: string;
  data_nascimento: string;
  contato_emergencia: string;
  
  // Histórico de Saúde
  doencas_cronicas: string[];
  outras_condicoes: string;
  deficiencias: string[];
  
  // Medicações
  medicacoes: Array<{
    nome: string;
    dosagem: string;
    horarios: string[];
    observacoes: string;
  }>;
  
  // Rotina Diária
  qualidade_sono: string;
  alimentacao: string;
  hidratacao: string;
  atividades_realizadas: string[];
  observacoes_rotina: string;
  
  // Aspectos Clínicos
  pressao_arterial: string;
  frequencia_cardiaca: string;
  temperatura: string;
  glicemia: string;
  observacoes_clinicas: string;
  
  // Bem-Estar
  humor: string;
  dor: number[];
  apetite: string;
  interacao_social: string;
  
  // Ocorrências
  ocorrencias: string[];
  detalhes_ocorrencia: string;
  
  // Observações Gerais
  observacoes_gerais: string;
}

interface NovoFormularioProntuarioProps {
  funcionarioId: string;
  residenteId: string;
}

export default function NovoFormularioProntuario({ funcionarioId, residenteId }: NovoFormularioProntuarioProps) {
  const { toast } = useToast();
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  
  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<FormularioData>({
    defaultValues: {
      medicacoes: [{ nome: "", dosagem: "", horarios: [], observacoes: "" }],
      dor: [0],
      doencas_cronicas: [],
      deficiencias: [],
      atividades_realizadas: [],
      ocorrencias: []
    }
  });

  const watchedValues = watch();

  // Auto-save functionality
  useEffect(() => {
    const timer = setTimeout(() => {
      if (registroId || Object.keys(watchedValues).some(key => watchedValues[key as keyof FormularioData])) {
        saveFormData();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [watchedValues]);

  const saveFormData = async () => {
    setIsSaving(true);
    try {
      const formData = {
        residente_id: residenteId,
        funcionario_id: funcionarioId,
        data_registro: new Date().toISOString().split('T')[0],
        horario_registro: new Date().toTimeString().split(' ')[0],
        tipo_registro: 'prontuario_completo',
        titulo: 'Prontuário Diário',
        descricao: JSON.stringify(watchedValues),
        observacoes: watchedValues.observacoes_gerais || ''
      };

      if (registroId) {
        const { error } = await supabase
          .from('prontuario_registros')
          .update(formData)
          .eq('id', registroId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('prontuario_registros')
          .insert(formData)
          .select()
          .single();
        
        if (error) throw error;
        setRegistroId(data.id);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const finalizarFormulario = async () => {
    setIsFinalizando(true);
    try {
      await saveFormData();
      toast({
        title: "Prontuário finalizado",
        description: "O prontuário foi salvo e finalizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao finalizar",
        description: "Ocorreu um erro ao finalizar o prontuário.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizando(false);
    }
  };

  const doencasCronicas = [
    "Diabetes", "Hipertensão", "Alzheimer", "Parkinson", "Artrite", 
    "Osteoporose", "Demência", "Cardiopatia", "DPOC", "AVC"
  ];

  const deficienciasList = [
    "Auditiva", "Visual", "Motora", "Cognitiva"
  ];

  const atividadesList = [
    "Fisioterapia", "Caminhada", "Artesanato", "Música", 
    "Roda de conversa", "Passeio", "Leitura", "Jogos"
  ];

  const ocorrenciasList = [
    "Queda", "Febre", "Pressão alterada", "Glicemia alterada", 
    "Agitação", "Recusa alimentar", "Confusão mental"
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header com status de salvamento */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Prontuário Diário</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isSaving && <span>Salvando...</span>}
            {!isSaving && registroId && <span>✓ Salvo</span>}
          </div>
        </div>
      </div>

      {/* Identificação do Idoso */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            Identificação do Idoso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nome_completo">Nome completo</Label>
            <Input 
              id="nome_completo"
              {...register("nome_completo")}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="data_nascimento">Data de nascimento</Label>
            <Input 
              id="data_nascimento"
              type="date"
              {...register("data_nascimento")}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="contato_emergencia">Contato de emergência</Label>
            <Input 
              id="contato_emergencia"
              {...register("contato_emergencia")}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Saúde */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="w-5 h-5" />
            Histórico de Saúde
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Doenças crônicas</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {doencasCronicas.map((doenca) => (
                <div key={doenca} className="flex items-center space-x-2">
                  <Checkbox 
                    id={doenca}
                    checked={watchedValues.doencas_cronicas?.includes(doenca) || false}
                    onCheckedChange={(checked) => {
                      const current = watchedValues.doencas_cronicas || [];
                      if (checked) {
                        setValue("doencas_cronicas", [...current, doenca]);
                      } else {
                        setValue("doencas_cronicas", current.filter(d => d !== doenca));
                      }
                    }}
                  />
                  <Label htmlFor={doenca} className="text-sm">{doenca}</Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label htmlFor="outras_condicoes">Outras condições médicas</Label>
            <Textarea 
              id="outras_condicoes"
              {...register("outras_condicoes")}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-base font-medium">Deficiências</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {deficienciasList.map((deficiencia) => (
                <div key={deficiencia} className="flex items-center space-x-2">
                  <Checkbox 
                    id={deficiencia}
                    checked={watchedValues.deficiencias?.includes(deficiencia) || false}
                    onCheckedChange={(checked) => {
                      const current = watchedValues.deficiencias || [];
                      if (checked) {
                        setValue("deficiencias", [...current, deficiencia]);
                      } else {
                        setValue("deficiencias", current.filter(d => d !== deficiencia));
                      }
                    }}
                  />
                  <Label htmlFor={deficiencia} className="text-sm">{deficiencia}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rotina Diária */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Rotina Diária
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Qualidade do sono</Label>
            <RadioGroup 
              value={watchedValues.qualidade_sono || ""}
              onValueChange={(value) => setValue("qualidade_sono", value)}
              className="mt-2"
            >
              {["Boa", "Regular", "Ruim"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`sono_${option}`} />
                  <Label htmlFor={`sono_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Alimentação</Label>
            <RadioGroup 
              value={watchedValues.alimentacao || ""}
              onValueChange={(value) => setValue("alimentacao", value)}
              className="mt-2"
            >
              {["Se alimenta sozinho", "Precisa de ajuda", "Dieta especial"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`alim_${option}`} />
                  <Label htmlFor={`alim_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Hidratação</Label>
            <RadioGroup 
              value={watchedValues.hidratacao || ""}
              onValueChange={(value) => setValue("hidratacao", value)}
              className="mt-2"
            >
              {["Adequada", "Baixa", "Precisa de incentivo"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`hidrat_${option}`} />
                  <Label htmlFor={`hidrat_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Atividades realizadas</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {atividadesList.map((atividade) => (
                <div key={atividade} className="flex items-center space-x-2">
                  <Checkbox 
                    id={atividade}
                    checked={watchedValues.atividades_realizadas?.includes(atividade) || false}
                    onCheckedChange={(checked) => {
                      const current = watchedValues.atividades_realizadas || [];
                      if (checked) {
                        setValue("atividades_realizadas", [...current, atividade]);
                      } else {
                        setValue("atividades_realizadas", current.filter(a => a !== atividade));
                      }
                    }}
                  />
                  <Label htmlFor={atividade} className="text-sm">{atividade}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes_rotina">Observações sobre a rotina</Label>
            <Textarea 
              id="observacoes_rotina"
              {...register("observacoes_rotina")}
              className="mt-1 min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Aspectos Clínicos */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="w-5 h-5" />
            Aspectos Clínicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pressao_arterial">Pressão arterial</Label>
              <Input 
                id="pressao_arterial"
                placeholder="Ex: 120/80"
                {...register("pressao_arterial")}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frequencia_cardiaca">Freq. cardíaca</Label>
              <Input 
                id="frequencia_cardiaca"
                placeholder="Ex: 72 bpm"
                {...register("frequencia_cardiaca")}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="temperatura">Temperatura</Label>
              <Input 
                id="temperatura"
                placeholder="Ex: 36.5°C"
                {...register("temperatura")}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="glicemia">Glicemia</Label>
              <Input 
                id="glicemia"
                placeholder="Ex: 95 mg/dL"
                {...register("glicemia")}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes_clinicas">Observações clínicas</Label>
            <Textarea 
              id="observacoes_clinicas"
              {...register("observacoes_clinicas")}
              className="mt-1 min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Avaliação de Bem-Estar */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smile className="w-5 h-5" />
            Avaliação de Bem-Estar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Humor</Label>
            <RadioGroup 
              value={watchedValues.humor || ""}
              onValueChange={(value) => setValue("humor", value)}
              className="mt-2"
            >
              {["Feliz", "Ansioso", "Acentuado", "Irritado", "Outro"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`humor_${option}`} />
                  <Label htmlFor={`humor_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">
              Nível de dor (0 - sem dor, 10 - dor intensa): {watchedValues.dor?.[0] || 0}
            </Label>
            <Slider
              value={watchedValues.dor || [0]}
              onValueChange={(value) => setValue("dor", value)}
              max={10}
              step={1}
              className="mt-3"
            />
          </div>

          <div>
            <Label className="text-base font-medium">Apetite</Label>
            <RadioGroup 
              value={watchedValues.apetite || ""}
              onValueChange={(value) => setValue("apetite", value)}
              className="mt-2"
            >
              {["Bom", "Regular", "Ruim"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`apetite_${option}`} />
                  <Label htmlFor={`apetite_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Interação social</Label>
            <RadioGroup 
              value={watchedValues.interacao_social || ""}
              onValueChange={(value) => setValue("interacao_social", value)}
              className="mt-2"
            >
              {["Boa", "Média", "Isolado"].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`social_${option}`} />
                  <Label htmlFor={`social_${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Registro de Ocorrências */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5" />
            Registro de Ocorrências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base font-medium">Ocorrências</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {ocorrenciasList.map((ocorrencia) => (
                <div key={ocorrencia} className="flex items-center space-x-2">
                  <Checkbox 
                    id={ocorrencia}
                    checked={watchedValues.ocorrencias?.includes(ocorrencia) || false}
                    onCheckedChange={(checked) => {
                      const current = watchedValues.ocorrencias || [];
                      if (checked) {
                        setValue("ocorrencias", [...current, ocorrencia]);
                      } else {
                        setValue("ocorrencias", current.filter(o => o !== ocorrencia));
                      }
                    }}
                  />
                  <Label htmlFor={ocorrencia} className="text-sm">{ocorrencia}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="detalhes_ocorrencia">Detalhes da ocorrência</Label>
            <Textarea 
              id="detalhes_ocorrencia"
              {...register("detalhes_ocorrencia")}
              className="mt-1 min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Observações Gerais */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Observações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="observacoes_gerais">Anotações gerais</Label>
            <Textarea 
              id="observacoes_gerais"
              {...register("observacoes_gerais")}
              className="mt-1 min-h-[120px]"
              placeholder="Digite aqui suas observações gerais sobre o idoso hoje..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão de finalizar fixo na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
        <Button 
          onClick={finalizarFormulario}
          disabled={isFinalizando}
          className="w-full h-12 text-lg font-semibold"
          size="lg"
        >
          {isFinalizando ? "Finalizando..." : "Finalizar Prontuário"}
        </Button>
      </div>
    </div>
  );
}