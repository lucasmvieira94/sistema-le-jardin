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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Heart, Pill, Clock, Stethoscope, Smile, AlertTriangle, FileText, ArrowLeft, Users, CheckCircle, Shield, Lock } from "lucide-react";
import CodigoFinalizacaoProntuario from "./CodigoFinalizacaoProntuario";

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
  cicloStatus?: string;
  onChangeResidente?: (residenteId: string) => void;
  onVoltar?: () => void;
  onStatusChange?: (residenteId: string, status: string, cicloId: string) => void;
}

export default function NovoFormularioProntuario({ 
  funcionarioId, 
  residenteId, 
  cicloStatus: cicloStatusProp,
  onChangeResidente, 
  onVoltar,
  onStatusChange 
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
  const [loading, setLoading] = useState(true);
  const [camposConfigurados, setCamposConfigurados] = useState<any[]>([]);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [showCodigoDialog, setShowCodigoDialog] = useState(false);
  
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

        // Se já temos o status do ciclo passado pela prop, usá-lo
        if (cicloStatusProp && cicloStatusProp !== 'nao_iniciado') {
          setCicloStatus(cicloStatusProp);
          
          if (cicloStatusProp === 'encerrado') {
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

          // Buscar ciclo existente
          const { data: verificacao, error: verificacaoError } = await supabase
            .rpc('verificar_prontuario_diario_existente', { 
              p_residente_id: residenteId 
            });

          if (!verificacaoError && verificacao && verificacao.length > 0) {
            const cicloExistente = verificacao[0];
            if (cicloExistente && typeof cicloExistente === 'object' && cicloExistente.ciclo_id) {
              setCicloId(cicloExistente.ciclo_id);

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
            }
          }
        } else {
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
          
          if (cicloExistente && typeof cicloExistente === 'object' && cicloExistente.ciclo_id) {
            setCicloId(cicloExistente.ciclo_id);
            setCicloStatus(cicloExistente.status);
            
            if (cicloExistente.status === 'encerrado') {
              setProntuarioJaFinalizado(true);
              toast({
                title: "Prontuário já finalizado",
                description: "Este prontuário já foi finalizado hoje.",
                variant: "default",
              });
            } else if (cicloExistente.status === 'nao_iniciado') {
              // Iniciar o prontuário automaticamente
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

              const resultado = typeof novoCiclo?.[0] === 'string' ? { success: true, ciclo_id: novoCiclo[0], message: 'Ciclo criado' } : novoCiclo?.[0];
              if (resultado?.success && resultado.ciclo_id) {
                setCicloId(resultado.ciclo_id);
                setCicloStatus('em_andamento');
                
                // Marcar início efetivo no banco
                await supabase
                  .from('prontuario_ciclos')
                  .update({
                    status: 'em_andamento',
                    data_inicio_efetivo: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', resultado.ciclo_id);
                
                // Atualizar o status imediatamente
                onStatusChange?.(residenteId, 'em_andamento', resultado.ciclo_id);
                
                toast({
                  title: "Prontuário iniciado",
                  description: resultado.message || "Prontuário iniciado com sucesso",
                });
              }
            } else {
              toast({
                title: "Prontuário em andamento",
                description: "Continuando o prontuário de hoje...",
              });
            }

            // Carregar dados existentes do prontuário se não for nao_iniciado
            if (cicloExistente.status !== 'nao_iniciado') {
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

            const resultado = typeof novoCiclo?.[0] === 'string' ? { success: true, ciclo_id: novoCiclo[0], message: 'Ciclo criado' } : novoCiclo?.[0];
            if (resultado?.success && resultado.ciclo_id) {
              setCicloId(resultado.ciclo_id);
              setCicloStatus('em_andamento');
              
              // Marcar início efetivo no banco
              await supabase
                .from('prontuario_ciclos')
                .update({
                  status: 'em_andamento',
                  data_inicio_efetivo: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', resultado.ciclo_id);
              
              // Atualizar o status imediatamente
              onStatusChange?.(residenteId, 'em_andamento', resultado.ciclo_id);
              
              toast({
                title: "Prontuário iniciado",
                description: resultado.message || "Prontuário iniciado com sucesso",
              });
            }
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
  }, [residenteId, funcionarioId, cicloStatusProp]);

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
    loadCamposConfigurados();
  }, []);

  // Carregar campos configurados do banco de dados
  const loadCamposConfigurados = async () => {
    try {
      console.log('🔧 Carregando campos configurados...');
      const { data, error } = await supabase
        .from('formulario_campos_config')
        .select('*')
        .eq('ativo', true)
        .order('secao, ordem');

      if (error) {
        console.error('❌ Erro ao carregar campos configurados:', error);
        throw error;
      }

      console.log('✅ Campos configurados carregados:', data);
      setCamposConfigurados(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração de campos:', error);
      toast({
        title: "Erro ao carregar configuração",
        description: "Usando campos padrão. Verifique a configuração do formulário.",
        variant: "destructive",
      });
    }
  };

  // Auto-save functionality (não salvar se finalizado)
  useEffect(() => {
    if (prontuarioJaFinalizado) return; // Não salvar se finalizado
    
    const timer = setTimeout(() => {
      if (registroId || Object.keys(watchedValues).some(key => watchedValues[key as keyof FormularioData])) {
        saveFormData();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [watchedValues, prontuarioJaFinalizado]);

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

  const handleConfirmFinalizar = async () => {
    setShowFinalizarDialog(false);
    
    // Salvar dados atuais antes de abrir o diálogo de código
    setIsSaving(true);
    try {
      await saveFormData();
      setShowCodigoDialog(true);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Erro ao salvar dados antes da finalização.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalizarProntuario = async (codigo: string, funcionarioNome: string) => {
    setIsFinalizando(true);
    try {
      // Chamar função para finalizar o prontuário
      const { data, error } = await supabase
        .rpc('finalizar_prontuario_diario', {
          p_ciclo_id: cicloId,
          p_funcionario_id: funcionarioId,
          p_codigo_validacao: codigo
        });

      if (error) throw error;

      const result = data?.[0];
      
      if (result?.success) {
        toast({
          title: "Prontuário finalizado",
          description: `Prontuário finalizado com sucesso por ${funcionarioNome}`,
        });
        
        setShowCodigoDialog(false);
        setProntuarioJaFinalizado(true);
        setCicloStatus('encerrado');
        
        // Buscar próximo prontuário disponível
        const { data: proximoData, error: proximoError } = await supabase
          .rpc('buscar_proximo_prontuario', {
            p_residente_atual: residenteId
          });

        if (!proximoError && proximoData?.[0]) {
          const proximoResidente = proximoData[0];
          toast({
            title: "Navegando para próximo prontuário",
            description: `Abrindo prontuário de ${proximoResidente.nome_completo}`,
            variant: "default",
          });
          
          // Navegar para o próximo residente após um pequeno delay
          setTimeout(() => {
            onChangeResidente?.(proximoResidente.residente_id);
          }, 1500);
        } else {
          toast({
            title: "Todos os prontuários concluídos!",
            description: "Não há mais prontuários pendentes para hoje.",
            variant: "default",
          });
          
          // Voltar para a lista após delay
          setTimeout(() => {
            onVoltar?.();
          }, 2000);
        }
      } else {
        toast({
          title: "Erro ao finalizar",
          description: result?.message || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao finalizar prontuário:', error);
      toast({
        title: "Erro ao finalizar",
        description: "Não foi possível finalizar o prontuário.",
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

  // Função para renderizar campo dinamicamente baseado na configuração
  const renderCampoConfigurado = (campo: any, valor: any, onChange: (valor: any) => void) => {
    console.log('🎯 Renderizando campo:', campo.label, 'Tipo:', campo.tipo);
    
    // Desabilitar campos se prontuário finalizado
    const isDisabled = prontuarioJaFinalizado;
    
    switch (campo.tipo) {
      case 'text':
        return (
          <div key={campo.id}>
            <Label htmlFor={campo.id} className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={campo.id}
              placeholder={isDisabled ? "Campo bloqueado - prontuário finalizado" : (campo.placeholder || '')}
              value={valor || ''}
              onChange={(e) => !isDisabled && onChange(e.target.value)}
              className="mt-1"
              disabled={isDisabled}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={campo.id}>
            <Label htmlFor={campo.id} className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={campo.id}
              placeholder={isDisabled ? "Campo bloqueado - prontuário finalizado" : (campo.placeholder || '')}
              value={valor || ''}
              onChange={(e) => !isDisabled && onChange(e.target.value)}
              className="mt-1 min-h-[80px]"
              rows={campo.configuracoes?.rows || 3}
              disabled={isDisabled}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={campo.id}>
            <Label className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={valor || ""}
              onValueChange={(value) => !isDisabled && onChange(value)}
              className="mt-2"
              disabled={isDisabled}
            >
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={opcao} 
                    id={`${campo.id}_${opcao}`} 
                    disabled={isDisabled}
                  />
                  <Label 
                    htmlFor={`${campo.id}_${opcao}`}
                    className={isDisabled ? "text-muted-foreground" : ""}
                  >
                    {opcao}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'checkbox':
        return (
          <div key={campo.id}>
            <Label className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${campo.id}_${opcao}`}
                    checked={Array.isArray(valor) ? valor.includes(opcao) : false}
                    onCheckedChange={(checked) => {
                      if (isDisabled) return;
                      const current = Array.isArray(valor) ? valor : [];
                      if (checked) {
                        onChange([...current, opcao]);
                      } else {
                        onChange(current.filter((item: string) => item !== opcao));
                      }
                    }}
                    disabled={isDisabled}
                  />
                  <Label 
                    htmlFor={`${campo.id}_${opcao}`} 
                    className={`text-sm ${isDisabled ? "text-muted-foreground" : ""}`}
                  >
                    {opcao}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={campo.id}>
            <Label htmlFor={campo.id} className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select 
              value={valor || ""} 
              onValueChange={(value) => !isDisabled && onChange(value)}
              disabled={isDisabled}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={
                  isDisabled ? "Campo bloqueado - prontuário finalizado" : 
                  (campo.placeholder || "Selecione uma opção")
                } />
              </SelectTrigger>
              <SelectContent className="bg-white border shadow-lg z-50">
                {(campo.opcoes || []).map((opcao: string) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'slider':
        const configuracoes = campo.configuracoes || {};
        const min = configuracoes.min || 0;
        const max = configuracoes.max || 10;
        const step = configuracoes.step || 1;
        const currentValue = Array.isArray(valor) ? valor[0] : (valor || min);
        
        return (
          <div key={campo.id}>
            <Label className="text-base font-medium">
              {campo.label}: {currentValue}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Slider
              value={[currentValue]}
              onValueChange={(newValue) => !isDisabled && onChange(newValue)}
              min={min}
              max={max}
              step={step}
              className="mt-3"
              disabled={isDisabled}
            />
            {isDisabled && (
              <p className="text-xs text-muted-foreground mt-1">
                Campo bloqueado - prontuário finalizado
              </p>
            )}
          </div>
        );

      case 'number':
        const numConfig = campo.configuracoes || {};
        return (
          <div key={campo.id}>
            <Label htmlFor={campo.id} className="text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={campo.id}
              type="number"
              placeholder={isDisabled ? "Campo bloqueado - prontuário finalizado" : (campo.placeholder || '')}
              value={valor || ''}
              onChange={(e) => !isDisabled && onChange(e.target.value)}
              min={numConfig.min}
              max={numConfig.max}
              step={numConfig.step}
              className="mt-1"
              disabled={isDisabled}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Agrupar campos por seção
  const camposPorSecao = camposConfigurados.reduce((acc: any, campo: any) => {
    if (!acc[campo.secao]) {
      acc[campo.secao] = [];
    }
    acc[campo.secao].push(campo);
    return acc;
  }, {});

  // Mapeamento de ícones por seção
  const iconesSecao: { [key: string]: any } = {
    rotina_diaria: Clock,
    aspectos_clinicos: Stethoscope,
    bem_estar: Smile,
    ocorrencias: AlertTriangle,
    observacoes: FileText
  };

  // Títulos das seções
  const titulosSecao: { [key: string]: string } = {
    rotina_diaria: 'Rotina Diária',
    aspectos_clinicos: 'Aspectos Clínicos',
    bem_estar: 'Avaliação de Bem-Estar',
    ocorrencias: 'Registro de Ocorrências',
    observacoes: 'Observações Gerais'
  };

  // Definir ordem das seções
  const ordemSecoes = ['rotina_diaria', 'aspectos_clinicos', 'bem_estar', 'ocorrencias', 'observacoes'];

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

      {/* Renderizar seções dinamicamente baseadas na configuração com ordem específica */}
      {Object.keys(camposPorSecao).length > 0 ? (
        ordemSecoes
          .filter(secao => camposPorSecao[secao]) // Apenas seções que existem
          .map((secao) => {
            const campos = camposPorSecao[secao];
            const Icone = iconesSecao[secao] || FileText;
            const titulo = titulosSecao[secao] || secao;
            
            console.log(`🔄 Renderizando seção: ${titulo} com ${campos.length} campos`);
            
            return (
              <Card key={secao}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icone className="w-5 h-5" />
                    {titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {campos
                    .sort((a: any, b: any) => a.ordem - b.ordem)
                    .map((campo: any) => {
                      const chaveFormulario = `campo_${campo.id}`;
                      const valorAtual = (watchedValues as any)[chaveFormulario];
                      
                      return renderCampoConfigurado(
                        campo,
                        valorAtual,
                        (novoValor) => setValue(chaveFormulario as any, novoValor)
                      );
                    })}
                </CardContent>
              </Card>
            );
          })
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Configuração não encontrada</h3>
            <p className="text-muted-foreground">
              Nenhum campo foi configurado para o formulário. 
              Acesse a configuração do formulário para adicionar campos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Aviso de prontuário finalizado */}
      {prontuarioJaFinalizado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800 font-medium">
              Este prontuário foi finalizado e não pode mais ser editado. 
              A edição será liberada no próximo ciclo diário.
            </p>
          </div>
        </div>
      )}

      {/* Botão de finalizar fixo na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
        <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
          <AlertDialogTrigger asChild>
            <Button 
              onClick={handleFinalizarClick}
              disabled={isFinalizando || loading || prontuarioJaFinalizado}
              className={`w-full h-12 text-lg font-semibold ${
                prontuarioJaFinalizado ? 'bg-green-600 hover:bg-green-700' : ''
              }`}
              size="lg"
              variant={prontuarioJaFinalizado ? "secondary" : "default"}
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
                  <Shield className="w-5 h-5 mr-2" />
                  Finalizar Prontuário
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Finalizar Prontuário
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                <strong>Atenção:</strong> Uma vez finalizado, este prontuário não poderá mais ser acessado ou editado hoje. 
                <br /><br />
                • O prontuário será marcado como <strong>FINALIZADO</strong>
                <br />
                • Não será possível fazer alterações até o próximo ciclo diário
                <br />
                • Esta ação requer confirmação com código de funcionário
                <br /><br />
                Deseja realmente finalizar este prontuário?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmFinalizar}>
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Dialog para validação com código */}
      <Dialog open={showCodigoDialog} onOpenChange={setShowCodigoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Prontuário</DialogTitle>
          </DialogHeader>
          <CodigoFinalizacaoProntuario
            onCodigoValidado={handleFinalizarProntuario}
            onCancel={() => setShowCodigoDialog(false)}
            disabled={isFinalizando}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
