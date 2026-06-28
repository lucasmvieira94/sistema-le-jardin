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
import { User, Heart, Pill, Clock, Stethoscope, Smile, AlertTriangle, FileText, ArrowLeft, Users, CheckCircle, Shield, Lock, Save } from "lucide-react";
import CodigoFinalizacaoProntuario from "./CodigoFinalizacaoProntuario";
import AssistenteProntuarioIA from "./AssistenteProntuarioIA";

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

  // Verificar ciclo diário e inicializar prontuário - SIMPLIFICADO
  useEffect(() => {
    const inicializarProntuario = async () => {
      console.log('🔄 Inicializando prontuário para residente:', residenteId);
      setLoading(true);
      try {
        // Buscar dados do residente
        const { data: residenteData, error: residenteError } = await supabase
          .from('residentes')
          .select('*')
          .eq('id', residenteId)
          .single();
        
        if (residenteError) {
          console.error('❌ Erro ao buscar residente:', residenteError);
          return;
        }
        
        setResidenteData(residenteData);
        console.log('✅ Dados do residente carregados:', residenteData.nome_completo);

        // Verificar ciclo existente - SEMPRE buscar do banco
        const { data: verificacao, error: verificacaoError } = await supabase
          .rpc('verificar_prontuario_diario_existente', { 
            p_residente_id: residenteId 
          });

        if (verificacaoError) {
          console.error('❌ Erro ao verificar prontuário:', verificacaoError);
          return;
        }

        const cicloExistente = verificacao?.[0];
        console.log('🔍 Ciclo encontrado:', cicloExistente);
        
        // Sempre usar os dados do banco, não da prop
        if (cicloExistente?.ja_iniciado) {
          const statusAtual = cicloExistente.status;
          console.log('📋 Status atual do ciclo:', statusAtual);
          
          setCicloId(cicloExistente.ciclo_id);
          setCicloStatus(statusAtual);
          
          // Verificar se está finalizado
          if (statusAtual === 'encerrado') {
            setProntuarioJaFinalizado(true);
          } else {
            setProntuarioJaFinalizado(false);
          }
          
          // Sempre carregar dados existentes se há um ciclo válido
          if (statusAtual !== 'nao_iniciado') {
            console.log('📥 Carregando dados existentes do prontuário...');
            const { data: registroExistente } = await supabase
              .from('prontuario_registros')
              .select('*')
              .eq('ciclo_id', cicloExistente.ciclo_id)
              .eq('tipo_registro', 'prontuario_completo')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (registroExistente) {
              console.log('✅ Registro existente encontrado, carregando dados...');
              setRegistroId(registroExistente.id);
              try {
                const dadosExistentes = JSON.parse(registroExistente.descricao);
                
                // Aplicar dados existentes ao formulário
                Object.keys(dadosExistentes).forEach(key => {
                  setValue(key as keyof FormularioData, dadosExistentes[key]);
                });
                
                console.log('✅ Dados do prontuário carregados no formulário');
              } catch (e) {
                console.log('❌ Erro ao parsear dados existentes:', e);
              }
            } else {
              console.log('ℹ️ Nenhum registro existente encontrado para este ciclo');
            }
          }
          
          // Atualizar callback de status
          onStatusChange?.(residenteId, statusAtual, cicloExistente.ciclo_id);
          
        } else {
          console.log('🆕 Nenhum ciclo existente, será criado quando necessário');
          // Não criar ciclo aqui, deixar para quando o usuário começar a preencher
        }

      } catch (error) {
        console.error('❌ Erro ao inicializar prontuário:', error);
        toast({
          title: "Erro inesperado",
          description: "Não foi possível inicializar o prontuário.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    // Só inicializar se não estiver carregando para evitar loops
    if (residenteId && funcionarioId) {
      inicializarProntuario();
    }
  }, [residenteId, funcionarioId, setValue, toast]); // Dependências mínimas

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

  // Auto-save otimizado: dispara mesmo sem ciclo (saveFormData cria o ciclo).
  useEffect(() => {
    if (prontuarioJaFinalizado || loading || isSaving) {
      return;
    }

    const timer = setTimeout(() => {
      console.log('⏰ Timer do auto-save acionado');
      
      // Verificação se há dados significativos
      const hasRealData = Object.keys(watchedValues).some(key => {
        const value = watchedValues[key as keyof FormularioData];
        
        // Priorizar campos configurados (campo_xxx)
        if (key.startsWith('campo_')) {
          if (typeof value === 'string') return value.trim().length > 0;
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === 'number') return !isNaN(value) && isFinite(value);
          return value !== undefined && value !== null && value !== '';
        }
        
        // Verificar medicações
        if (key === 'medicacoes') {
          return Array.isArray(value) && value.some((med: any) => 
            med.nome?.trim() || med.dosagem?.trim()
          );
        }
        
        // Verificar arrays
        if (Array.isArray(value)) {
          return value.length > 0 && value.some(v => v?.toString().trim());
        }
        
        // Verificar strings (mínimo 2 caracteres para evitar auto-save por engano)
        if (typeof value === 'string') return value.trim().length > 2;
        
        // Verificar números
        if (typeof value === 'number') return !isNaN(value) && isFinite(value);
        
        return false;
      });
      
      // Auto-save sempre que houver dados válidos. Se o ciclo ainda não existir
      // ou estiver em 'nao_iniciado', o próprio saveFormData cria/promove o ciclo.
      if (hasRealData) {
        console.log('💾 Auto-save executado com dados válidos (status:', cicloStatus, ')');
        saveFormData(false);
      }
    }, 5000); // 5 segundos

    return () => {
      clearTimeout(timer);
    };
  }, [watchedValues, prontuarioJaFinalizado, cicloId, cicloStatus, loading, isSaving]);

  // Flush de segurança: salva ao sair da página / trocar de aba.
  useEffect(() => {
    if (prontuarioJaFinalizado || loading) return;

    const flush = () => {
      // dispara save assíncrono (sem await — beforeunload não espera)
      saveFormData(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      // Salva também ao desmontar o componente (ex: trocar de residente)
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontuarioJaFinalizado, loading, cicloId, watchedValues]);

  const saveFormData = async (showSuccessToast = false) => {
    // Verificações iniciais mais rigorosas
    if (prontuarioJaFinalizado) {
      console.log('❌ Prontuário finalizado, não é possível salvar');
      return;
    }
    
    // Se não há ciclo, criar um silenciosamente
    if (!cicloId) {
      console.log('🆕 Criando ciclo antes do salvamento...');
      try {
        const { data: novoCiclo, error: cicloError } = await supabase
          .rpc('iniciar_prontuario_diario', {
            p_residente_id: residenteId,
            p_funcionario_id: funcionarioId
          });

        if (cicloError) {
          console.error('❌ Erro ao criar ciclo:', cicloError);
          return;
        }

        const resultado = novoCiclo?.[0];
        if (resultado?.success) {
          setCicloId(resultado.ciclo_id);
          setCicloStatus('em_andamento');
          onStatusChange?.(residenteId, 'em_andamento', resultado.ciclo_id);
        } else {
          console.error('❌ Falha ao criar ciclo');
          return;
        }
      } catch (error) {
        console.error('❌ Erro inesperado ao criar ciclo:', error);
        return;
      }
    }
    
    setIsSaving(true);
    console.log('💾 Iniciando salvamento dos dados do prontuário...');
    
    try {
      // Buscar registro existente
      console.log('🔍 Buscando registro existente para ciclo:', cicloId);
      const { data: registroExistente, error: buscaError } = await supabase
        .from('prontuario_registros')
        .select('id')
        .eq('ciclo_id', cicloId)
        .eq('tipo_registro', 'prontuario_completo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (buscaError && buscaError.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar registro existente:', buscaError);
        throw buscaError;
      }

      const registroEncontrado = registroExistente?.id || registroId;

      // Validação de dados significativos
      const hasSignificantData = Object.keys(watchedValues).some(key => {
        const value = watchedValues[key as keyof FormularioData];
        
        // Priorizar campos configurados
        if (key.startsWith('campo_')) {
          if (typeof value === 'string') return value.trim().length > 0;
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === 'number') return !isNaN(value) && isFinite(value);
          return value !== undefined && value !== null && value !== '';
        }
        
        // Medicações
        if (key === 'medicacoes') {
          return Array.isArray(value) && value.some((med: any) => 
            med.nome?.trim() || med.dosagem?.trim() || (med.horarios && med.horarios.length > 0)
          );
        }
        
        // Arrays
        if (Array.isArray(value)) {
          return value.length > 0 && value.some(v => {
            if (typeof v === 'string') return v.trim().length > 0;
            return v !== undefined && v !== null;
          });
        }
        
        // Strings
        if (typeof value === 'string') return value.trim().length > 0;
        
        // Números
        if (typeof value === 'number') return !isNaN(value) && isFinite(value);
        
        return value !== undefined && value !== null && value !== '';
      });
      
      if (!hasSignificantData) {
        console.log('⚠️ Nenhum dado significativo encontrado, pulando salvamento');
        return;
      }
      
      console.log('📊 Dados válidos encontrados, salvando...');
      
      // Preparar dados
      const dados = JSON.stringify(watchedValues);
      let savedData;
      
      if (registroEncontrado) {
        console.log('📝 Atualizando prontuário existente:', registroEncontrado);
        
        const { data, error } = await supabase
          .from('prontuario_registros')
          .update({
            descricao: dados,
            funcionario_id: funcionarioId,
            updated_at: new Date().toISOString()
          })
          .eq('id', registroEncontrado)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Erro ao atualizar prontuário:', {
            error,
            registroId: registroEncontrado,
            funcionarioId
          });
          throw error;
        }
        
        console.log('✅ Prontuário atualizado com sucesso');
        if (!registroId) setRegistroId(registroEncontrado); // Garantir que o state está correto
        savedData = data;
        
        if (showSuccessToast) {
          toast({
            title: "Dados atualizados",
            description: "Informações salvas com sucesso!",
          });
        }
      } else {
        console.log('🆕 Criando novo prontuário...');
        
        const { data, error } = await supabase
          .from('prontuario_registros')
          .insert({
            ciclo_id: cicloId,
            residente_id: residenteId,
            funcionario_id: funcionarioId,
            tipo_registro: 'prontuario_completo',
            titulo: 'Prontuário Completo',
            descricao: dados,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          console.error('❌ Erro ao inserir novo prontuário:', {
            error,
            cicloId,
            funcionarioId,
            residenteId
          });
          throw error;
        }
        
        console.log('✅ Novo prontuário criado com sucesso:', {
          registroId: data?.id,
          cicloId
        });
        
        setRegistroId(data.id); // Definir imediatamente no state
        savedData = data;
        
        if (showSuccessToast) {
          toast({
            title: "Prontuário criado",
            description: "Dados salvos com sucesso!",
          });
        }
      }

      // Forçar atualização do status do ciclo baseado no conteúdo
      if (hasSignificantData) {
        // Tentar atualizar o status do ciclo para 'em_andamento' ou 'completo'
        const newStatus = hasSignificantData ? 'em_andamento' : cicloStatus;
        
        const { error: statusError } = await supabase
          .from('prontuario_ciclos')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', cicloId);
        
        if (!statusError) {
          setCicloStatus(newStatus);
          // Notificar mudança de status para que o progresso seja recalculado na página pai
          onStatusChange?.(residenteId, newStatus, cicloId);
        }
      }
      
    } catch (error) {
      console.error('❌ Erro completo ao salvar prontuário:', {
        error,
        message: error?.message || 'Erro desconhecido',
        cicloId,
        registroId,
        funcionarioId,
        residenteId
      });
      toast({
        title: "Erro ao salvar",
        description: `Falha no salvamento: ${error?.message || 'Erro desconhecido'}. Tente novamente.`,
        variant: "destructive",
      });
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
      await saveFormData(true); // Mostrar toast de sucesso
      setShowCodigoDialog(true);
    } catch (error) {
      // Erro já tratado na função saveFormData
      return;
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
          <div key={campo.id} className="space-y-2">
            <Label htmlFor={campo.id} className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={campo.id}
              placeholder={isDisabled ? "Campo bloqueado - prontuário finalizado" : (campo.placeholder || '')}
              value={valor || ''}
              onChange={(e) => !isDisabled && onChange(e.target.value)}
              className="mt-1 text-sm sm:text-base"
              disabled={isDisabled}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={campo.id} className="space-y-2">
            <Label htmlFor={campo.id} className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={campo.id}
              placeholder={isDisabled ? "Campo bloqueado - prontuário finalizado" : (campo.placeholder || '')}
              value={valor || ''}
              onChange={(e) => !isDisabled && onChange(e.target.value)}
              className="mt-1 min-h-[80px] text-sm sm:text-base resize-none"
              rows={campo.configuracoes?.rows || 3}
              disabled={isDisabled}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={valor || ""}
              onValueChange={(value) => !isDisabled && onChange(value)}
              className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2"
              disabled={isDisabled}
            >
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                  <RadioGroupItem 
                    value={opcao} 
                    id={`${campo.id}_${opcao}`} 
                    disabled={isDisabled}
                  />
                  <Label 
                    htmlFor={`${campo.id}_${opcao}`}
                    className={`text-sm flex-1 cursor-pointer ${isDisabled ? "text-muted-foreground" : ""}`}
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
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-3">
              {(campo.opcoes || []).map((opcao: string) => (
                <div key={opcao} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
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
                    className={`text-sm flex-1 cursor-pointer ${isDisabled ? "text-muted-foreground" : ""}`}
                  >
                    {opcao}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'slider':
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="mt-3 px-2">
              <Slider
                value={Array.isArray(valor) ? valor : [campo.configuracoes?.min || 0]}
                onValueChange={(newValue) => !isDisabled && onChange(newValue)}
                max={campo.configuracoes?.max || 100}
                min={campo.configuracoes?.min || 0}
                step={campo.configuracoes?.step || 1}
                className="w-full touch-pan-x"
                disabled={isDisabled}
              />
              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground mt-2">
                <span>{campo.configuracoes?.min || 0}</span>
                <span className="font-medium">Valor: {Array.isArray(valor) ? valor[0] : (campo.configuracoes?.min || 0)}</span>
                <span>{campo.configuracoes?.max || 100}</span>
              </div>
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={campo.id} className="space-y-2">
            <Label className="text-sm sm:text-base font-medium">
              {campo.label}
              {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select 
              value={valor || ""} 
              onValueChange={(value) => !isDisabled && onChange(value)}
              disabled={isDisabled}
            >
              <SelectTrigger className="mt-1 text-sm sm:text-base">
                <SelectValue 
                  placeholder={isDisabled ? "Campo bloqueado" : "Selecione uma opção"} 
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {(campo.opcoes || []).map((opcao: string) => (
                  <SelectItem key={opcao} value={opcao} className="text-sm sm:text-base">
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  // Se ainda está carregando, não renderizar nada
  if (!funcionarioId) {
    return null; // Isso vai disparar o redirect no useEffect da página principal
  }

  // Agrupar campos por seção
  const camposPorSecao = camposConfigurados.reduce((acc: any, campo: any) => {
    if (!acc[campo.secao]) {
      acc[campo.secao] = [];
    }
    acc[campo.secao].push(campo);
    return acc;
  }, {});

  // Ícones para cada seção
  const iconesSecao: { [key: string]: any } = {
    identificacao: User,
    historico_saude: Heart,
    medicacoes: Pill,
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
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-20">
      {/* Header com navegação e status de salvamento */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-2 sm:p-4 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {onVoltar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onVoltar}
                className="flex items-center gap-1 sm:gap-2 flex-shrink-0"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Próximo Residente</span>
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold truncate">Prontuário Diário</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {residenteData?.nome_completo || 'Carregando...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Status de salvamento */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {isSaving && <span className="hidden sm:inline">Salvando...</span>}
              {!isSaving && registroId && <span>✓</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Identificação do Idoso */}
      <Card className="mx-2 sm:mx-0">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
            Identificação do Idoso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div>
            <Label className="text-sm font-medium">Nome completo</Label>
            <div className="mt-1 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm break-words">
              {residenteData?.nome_completo || 'Carregando...'}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Data de nascimento</Label>
            <div className="mt-1 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm">
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
      <Card className="mx-2 sm:mx-0">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
            Histórico de Saúde
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div>
            <Label className="text-sm sm:text-base font-medium">Condições médicas</Label>
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm break-words">
              {residenteData?.condicoes_medicas || 'Nenhuma condição médica cadastrada'}
            </div>
          </div>
          
          <div>
            <Label className="text-sm sm:text-base font-medium">Observações gerais do histórico</Label>
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-muted rounded-md text-xs sm:text-sm break-words">
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
              <Card key={secao} className="mx-2 sm:mx-0">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Icone className="w-4 h-4 sm:w-5 sm:h-5" />
                    {titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
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
        <Card className="mx-2 sm:mx-0">
          <CardContent className="p-6 sm:p-8 text-center">
            <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-base sm:text-lg font-medium mb-2">Configuração não encontrada</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Nenhum campo foi configurado para o formulário. 
              Acesse a configuração do formulário para adicionar campos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Aviso de prontuário finalizado */}
      {prontuarioJaFinalizado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4 mx-2 sm:mx-0">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-green-800 font-medium">
              Este prontuário foi finalizado e não pode mais ser editado. 
              A edição será liberada no próximo ciclo diário.
            </p>
          </div>
        </div>
      )}

      {/* Botão de finalizar fixo na parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-3 sm:p-4 safe-area-pb">
        <div className="flex gap-2 sm:gap-3 max-w-screen-xl mx-auto">
          {/* Indicador de salvamento e botão de salvar manual */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0">
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                <span className="hidden sm:inline">Salvando...</span>
              </>
            ) : !prontuarioJaFinalizado ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => saveFormData(true)}
                disabled={loading}
                className="h-10 sm:h-auto"
              >
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Salvar</span>
              </Button>
            ) : null}
          </div>
          
          <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                onClick={handleFinalizarClick}
                disabled={isFinalizando || loading || prontuarioJaFinalizado}
                className={`flex-1 h-10 sm:h-12 text-sm sm:text-lg font-semibold ${
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
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                    <span className="hidden sm:inline">Prontuário Finalizado</span>
                    <span className="sm:hidden">Finalizado</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                    <span className="hidden sm:inline">Finalizar Prontuário</span>
                    <span className="sm:hidden">Finalizar</span>
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

      {/* Assistente IA */}
      <AssistenteProntuarioIA
        residenteId={residenteId}
        funcionarioId={funcionarioId}
        residenteNome={residenteData?.nome_completo}
      />
    </div>
  );
}