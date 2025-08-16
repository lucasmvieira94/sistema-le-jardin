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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Heart, Pill, Clock, Stethoscope, Smile, AlertTriangle, FileText, ArrowLeft, Users, Lock, CheckCircle } from "lucide-react";
import CodigoFinalizacaoProntuario from "@/components/prontuario/CodigoFinalizacaoProntuario";

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
  onChangeResidente?: (residenteId: string) => void;
  onVoltar?: () => void;
}

export default function NovoFormularioProntuario({ 
  funcionarioId, 
  residenteId, 
  onChangeResidente, 
  onVoltar 
}: NovoFormularioProntuarioProps) {
  const { toast } = useToast();
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [residenteData, setResidenteData] = useState<any>(null);
  const [residentes, setResidentes] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [cicloStatus, setCicloStatus] = useState<string>('');
  const [prontuarioJaFinalizado, setProntuarioJaFinalizado] = useState(false);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  
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

  // Verificar ciclo diário e inicializar prontuário
  useEffect(() => {
    const inicializarProntuario = async () => {
      setLoading(true);
      try {
        // Buscar dados do residente
        const { data: residenteData, error: residenteError } = await supabase
          .from('residentes')
          .select('*')
          .eq('id', residenteId)
          .single();
        
        if (residenteError) {
          console.error('Erro ao buscar residente:', residenteError);
          return;
        } else {
          setResidenteData(residenteData);
        }

        // Verificar se já existe prontuário para hoje
        const { data: verificacao, error: verificacaoError } = await supabase
          .rpc('verificar_prontuario_diario_existente', { 
            p_residente_id: residenteId 
          });

        if (verificacaoError) {
          console.error('Erro ao verificar prontuário:', verificacaoError);
          return;
        }

        const cicloExistente = verificacao?.[0];
        
        if (cicloExistente?.ja_iniciado) {
          setCicloId(cicloExistente.ciclo_id);
          setCicloStatus(cicloExistente.status);
          
          if (cicloExistente.status === 'encerrado') {
            setProntuarioJaFinalizado(true);
            toast({
              title: "Prontuário já finalizado",
              description: "Este prontuário já foi finalizado hoje.",
              variant: "default",
            });
          } else {
            toast({
              title: "Prontuário em andamento",
              description: "Continuando o prontuário de hoje...",
            });
          }

          // Carregar dados existentes do prontuário
          const { data: registroExistente } = await supabase
            .from('prontuario_registros')
            .select('*')
            .eq('ciclo_id', cicloExistente.ciclo_id)
            .eq('tipo_registro', 'prontuario_completo')
            .single();

          if (registroExistente) {
            setRegistroId(registroExistente.id);
            try {
              const dadosExistentes = JSON.parse(registroExistente.descricao);
              Object.keys(dadosExistentes).forEach(key => {
                setValue(key as keyof FormularioData, dadosExistentes[key]);
              });
            } catch (e) {
              console.error('Erro ao carregar dados do prontuário:', e);
            }
          }
        } else {
          // Iniciar novo prontuário
          const { data: novoCiclo, error: cicloError } = await supabase
            .rpc('iniciar_prontuario_diario', {
              p_residente_id: residenteId,
              p_funcionario_id: funcionarioId
            });

          if (cicloError) {
            console.error('Erro ao iniciar prontuário:', cicloError);
            toast({
              title: "Erro ao iniciar prontuário",
              description: "Não foi possível iniciar o prontuário diário.",
              variant: "destructive",
            });
            return;
          }

          const resultado = novoCiclo?.[0];
          if (resultado?.success) {
            setCicloId(resultado.ciclo_id);
            setCicloStatus('em_andamento');
            toast({
              title: "Prontuário iniciado",
              description: resultado.message,
            });
          }
        }

      } catch (error) {
        console.error('Erro ao inicializar prontuário:', error);
        toast({
          title: "Erro inesperado",
          description: "Não foi possível inicializar o prontuário.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    inicializarProntuario();
  }, [residenteId, funcionarioId]);

  // Buscar lista de residentes para o dropdown
  useEffect(() => {
    const fetchResidentes = async () => {
      const { data, error } = await supabase
        .from('residentes')
        .select('*')
        .eq('ativo', true)
        .order('nome_completo');
      
      if (error) {
        console.error('Erro ao buscar residentes:', error);
      } else {
        setResidentes(data || []);
      }
    };

    fetchResidentes();
  }, []);

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
    if (!cicloId || prontuarioJaFinalizado) return;
    
    setIsSaving(true);
    try {
      const formData = {
        residente_id: residenteId,
        funcionario_id: funcionarioId,
        ciclo_id: cicloId,
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

  const handleFinalizarClick = () => {
    if (prontuarioJaFinalizado) {
      toast({
        title: "Prontuário já finalizado",
        description: "Este prontuário já foi finalizado hoje.",
        variant: "default",
      });
      return;
    }
    setShowFinalizarDialog(true);
  };

  const handleFinalizarComCodigo = async (codigoValidado: string, funcionarioValidado: string) => {
    setIsFinalizando(true);
    try {
      // Salvar dados antes de finalizar
      await saveFormData();

      // Finalizar o ciclo com validação de código
      const { data: resultado, error } = await supabase
        .rpc('finalizar_prontuario_diario', {
          p_ciclo_id: cicloId,
          p_funcionario_id: funcionarioId,
          p_codigo_validacao: codigoValidado
        });

      if (error) {
        console.error('Erro ao finalizar:', error);
        throw new Error('Erro na comunicação com o servidor');
      }

      const finalizacao = resultado?.[0];
      if (finalizacao?.success) {
        setCicloStatus('encerrado');
        setProntuarioJaFinalizado(true);
        setShowFinalizarDialog(false);
        
        toast({
          title: "Prontuário finalizado com sucesso!",
          description: finalizacao.message,
        });
      } else {
        throw new Error(finalizacao?.message || 'Erro ao finalizar prontuário');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao finalizar",
        description: error.message || "Ocorreu um erro ao finalizar o prontuário.",
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
      {/* Header com navegação e status de salvamento */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onVoltar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onVoltar}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold">Prontuário Diário</h2>
              <p className="text-sm text-muted-foreground">
                {residenteData?.nome_completo || 'Carregando...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Dropdown para trocar de residente */}
            <div className="min-w-[200px]">
              <Select 
                value={residenteId} 
                onValueChange={(value) => onChangeResidente?.(value)}
              >
                <SelectTrigger className="h-9 bg-white border-2 border-primary/20">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <SelectValue placeholder="Trocar residente..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  {residentes.map((residente) => (
                    <SelectItem 
                      key={residente.id} 
                      value={residente.id}
                      className="hover:bg-gray-100"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{residente.nome_completo}</span>
                        <span className="text-xs text-gray-500">
                          Quarto: {residente.quarto || 'N/A'} • Prontuário: {residente.numero_prontuario}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Status de salvamento */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving && <span>Salvando...</span>}
              {!isSaving && registroId && <span>✓ Salvo</span>}
            </div>
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
            <Label>Nome completo</Label>
            <div className="mt-1 p-3 bg-muted rounded-md text-sm">
              {residenteData?.nome_completo || 'Carregando...'}
            </div>
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <div className="mt-1 p-3 bg-muted rounded-md text-sm">
              {residenteData?.data_nascimento ? 
                new Date(residenteData.data_nascimento).toLocaleDateString('pt-BR') : 
                'Carregando...'}
            </div>
          </div>
          <div>
            <Label>Contato de emergência</Label>
            <div className="mt-1 p-3 bg-muted rounded-md text-sm">
              {residenteData?.responsavel_nome && residenteData?.responsavel_telefone ? 
                `${residenteData.responsavel_nome} - ${residenteData.responsavel_telefone}` :
                'Não informado'}
            </div>
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
            <Label className="text-base font-medium">Condições médicas</Label>
            <div className="mt-3 p-3 bg-muted rounded-md text-sm">
              {residenteData?.condicoes_medicas || 'Nenhuma condição médica cadastrada'}
            </div>
          </div>
          
          <div>
            <Label className="text-base font-medium">Observações gerais do histórico</Label>
            <div className="mt-3 p-3 bg-muted rounded-md text-sm">
              {residenteData?.observacoes_gerais || 'Nenhuma observação cadastrada'}
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
          onClick={handleFinalizarClick}
          disabled={isFinalizando || loading}
          className={`w-full h-12 text-lg font-semibold ${
            prontuarioJaFinalizado ? 'bg-green-600 hover:bg-green-700' : ''
          }`}
          size="lg"
        >
          {loading ? (
            "Carregando..."
          ) : isFinalizando ? (
            "Finalizando..."
          ) : prontuarioJaFinalizado ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Prontuário Finalizado
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 mr-2" />
              Finalizar Prontuário
            </>
          )}
        </Button>
      </div>

      {/* Modal de finalização com validação de código */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Finalizar Prontuário
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para finalizar o prontuário, digite seu código de 4 dígitos para confirmação:
            </p>
            
            <CodigoFinalizacaoProntuario 
              onCodigoValidado={handleFinalizarComCodigo}
              onCancel={() => setShowFinalizarDialog(false)}
              disabled={isFinalizando}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}