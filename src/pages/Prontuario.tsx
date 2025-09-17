import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileHeart, UserPlus, CheckCircle, Clock, FileX, Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import NovoFormularioProntuario from "@/components/prontuario/NovoFormularioProntuario";
import ResidentesList from "@/components/prontuario/ResidentesList";

export default function Prontuario() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [selectedResidente, setSelectedResidente] = useState<string | null>(null);
  const [residentes, setResidentes] = useState<any[]>([]);
  const [prontuariosStatus, setProntuariosStatus] = useState<Record<string, {status: string, cicloId: string | null, progresso?: number}>>({});

  // Verificar se já tem dados do funcionário na URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const funcId = searchParams.get('funcionario_id');
    const funcNome = searchParams.get('funcionario_nome');
    
    if (funcId && funcNome) {
      setFuncionarioId(funcId);
      setFuncionarioNome(decodeURIComponent(funcNome));
      
      // Carregar residentes imediatamente
      handleFuncionarioValidado(funcId, decodeURIComponent(funcNome));
    } else {
      // Se não tem dados na URL, redireciona para a página de acesso
      navigate('/funcionario-access');
    }
  }, [location, navigate]);

  const calcularProgressoBaseadoCampos = async (cicloId: string) => {
    try {
      // Buscar campos obrigatórios configurados
      const { data: camposObrigatorios, error: camposError } = await supabase
        .from('formulario_campos_config')
        .select('id, label, tipo')
        .eq('ativo', true)
        .eq('obrigatorio', true);

      if (camposError || !camposObrigatorios || camposObrigatorios.length === 0) {
        return 0; // Se não há campos obrigatórios ou erro, progresso 0
      }

      // Buscar registro do prontuário para este ciclo
      const { data: registro, error: registroError } = await supabase
        .from('prontuario_registros')
        .select('descricao')
        .eq('ciclo_id', cicloId)
        .eq('tipo_registro', 'prontuario_completo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registroError || !registro) {
        return 0; // Se não há dados salvos, progresso 0
      }

      // Analisar dados preenchidos
      let dadosPreenchidos;
      try {
        dadosPreenchidos = JSON.parse(registro.descricao);
      } catch (e) {
        return 0; // Se não consegue parsear, progresso 0
      }

      // Contar campos obrigatórios preenchidos
      let camposPreenchidos = 0;
      
      for (const campo of camposObrigatorios) {
        const chaveFormulario = `campo_${campo.id}`;
        const valor = dadosPreenchidos[chaveFormulario];
        
        // Verificar se o campo está preenchido baseado no tipo
        let preenchido = false;
        
        switch (campo.tipo) {
          case 'text':
          case 'textarea':
            preenchido = valor && typeof valor === 'string' && valor.trim().length > 0;
            break;
          case 'radio':
          case 'select':
            preenchido = valor && typeof valor === 'string' && valor.trim().length > 0;
            break;
          case 'checkbox':
            preenchido = Array.isArray(valor) && valor.length > 0;
            break;
          case 'slider':
            preenchido = Array.isArray(valor) && valor.length > 0 && valor[0] !== undefined;
            break;
          default:
            preenchido = valor !== undefined && valor !== null && valor !== '';
        }
        
        if (preenchido) {
          camposPreenchidos++;
        }
      }

      // Calcular progresso percentual
      const progressoPercentual = Math.round((camposPreenchidos / camposObrigatorios.length) * 100);
      console.log(`🎯 Progresso calculado: ${camposPreenchidos}/${camposObrigatorios.length} campos obrigatórios = ${progressoPercentual}%`);
      
      return progressoPercentual;
    } catch (error) {
      console.error('Erro ao calcular progresso baseado em campos:', error);
      return 0;
    }
  };

  const verificarStatusProntuarios = async (residentesData: any[]) => {
    const statusMap: Record<string, {status: string, cicloId: string | null, progresso?: number}> = {};
    
    for (const residente of residentesData) {
      try {
        // Buscar diretamente do banco de dados para ter informações atualizadas
        const { data: ciclo, error } = await supabase
          .from('prontuario_ciclos')
          .select('id, status, data_inicio_efetivo')
          .eq('residente_id', residente.id)
          .eq('data_ciclo', new Date().toISOString().split('T')[0])
          .single();

        if (!error && ciclo) {
          // Calcular progresso baseado nos campos obrigatórios preenchidos
          let progresso = 0;
          
          if (ciclo.status === 'encerrado') {
            progresso = 100; // Finalizado = 100%
          } else if (ciclo.status === 'nao_iniciado') {
            progresso = 0; // Não iniciado = 0%
          } else {
            // Para 'em_andamento' e 'completo', calcular baseado nos campos
            progresso = await calcularProgressoBaseadoCampos(ciclo.id);
          }
          
          statusMap[residente.id] = {
            status: ciclo.status,
            cicloId: ciclo.id,
            progresso
          };
        } else {
          // Se não encontrou ciclo, verificar com a função RPC como fallback
          const { data: verificacao, error: rpcError } = await supabase
            .rpc('verificar_prontuario_diario_existente', { 
              p_residente_id: residente.id 
            });
          
          if (!rpcError && verificacao?.[0]) {
            const cicloInfo = verificacao[0];
            
            let progresso = 0;
            if (cicloInfo.status === 'encerrado') {
              progresso = 100;
            } else if (cicloInfo.status === 'nao_iniciado') {
              progresso = 0;
            } else if (cicloInfo.ciclo_id) {
              progresso = await calcularProgressoBaseadoCampos(cicloInfo.ciclo_id);
            }
            
            statusMap[residente.id] = {
              status: cicloInfo.status || 'nao_iniciado',
              cicloId: cicloInfo.ciclo_id,
              progresso
            };
          } else {
            statusMap[residente.id] = {
              status: 'nao_iniciado',
              cicloId: null,
              progresso: 0
            };
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status do prontuário:', err);
        statusMap[residente.id] = {
          status: 'nao_iniciado',
          cicloId: null,
          progresso: 0
        };
      }
    }
    
    setProntuariosStatus(statusMap);
  };

  const handleFuncionarioValidado = async (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
    
    // Carregar residentes
    const { data } = await supabase
      .from('residentes')
      .select('*')
      .eq('ativo', true);
    
    if (data) {
      setResidentes(data);
      // Verificar status dos prontuários de cada residente
      await verificarStatusProntuarios(data);
    }
  };

  const recarregarStatusProntuarios = async () => {
    if (residentes.length > 0) {
      await verificarStatusProntuarios(residentes);
    }
  };

  const handleLogout = () => {
    navigate('/funcionario-access');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'nao_iniciado':
        return (
          <Badge className="flex items-center gap-1 bg-red-500 text-white">
            <FileX className="w-3 h-3" />
            Não Iniciado
          </Badge>
        );
      case 'em_andamento':
        return (
          <Badge className="flex items-center gap-1 bg-yellow-500 text-white">
            <Clock className="w-3 h-3" />
            Em Andamento
          </Badge>
        );
      case 'completo':
        return (
          <Badge className="flex items-center gap-1 bg-green-500 text-white">
            <CheckCircle className="w-3 h-3" />
            Completo
          </Badge>
        );
      case 'encerrado':
        return (
          <Badge className="flex items-center gap-1 bg-green-600 text-white">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </Badge>
        );
      default:
        return (
          <Badge className="flex items-center gap-1 bg-red-500 text-white">
            <FileX className="w-3 h-3" />
            Não Iniciado
          </Badge>
        );
    }
  };

  const getButtonText = (status: string) => {
    switch (status) {
      case 'nao_iniciado':
        return 'Iniciar Prontuário';
      case 'em_andamento':
        return 'Continuar Prontuário';
      case 'completo':
        return 'Finalizar Prontuário';
      case 'encerrado':
        return 'Ver Prontuário';
      default:
        return 'Iniciar Prontuário';
    }
  };

  const isButtonDisabled = (status: string) => {
    return status === 'encerrado';
  };

  // Se não tem funcionário ID, não renderiza nada (vai redirecionar)
  if (!funcionarioId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-2 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 truncate">
                  <FileHeart className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                  <span className="hidden sm:inline">Prontuário Eletrônico</span>
                  <span className="sm:hidden">Prontuário</span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {funcionarioNome}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {!selectedResidente ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center px-4">
              <UserPlus className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Selecione um residente</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Escolha o residente para preencher o prontuário diário
              </p>
            </div>
            
            {residentes.length === 0 ? (
              <div className="text-center mt-8">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Recarregar residentes
                </Button>
              </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
                {residentes.map((residente) => {
                  const statusInfo = prontuariosStatus[residente.id] || { status: 'nao_iniciado', cicloId: null, progresso: 0 };
                  const isDisabled = isButtonDisabled(statusInfo.status);
                  const hoje = new Date().toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                  
                  return (
                    <div
                      key={residente.id}
                      onClick={() => !isDisabled && setSelectedResidente(residente.id)}
                      className={`p-3 sm:p-4 bg-white rounded-lg border border-gray-200 transition-all ${
                        isDisabled 
                          ? 'cursor-not-allowed opacity-70' 
                          : 'hover:border-primary hover:shadow-md cursor-pointer active:scale-95'
                      } group`}
                    >
                      {/* Data do dia */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 pb-2 border-b border-gray-100">
                        <Calendar className="w-3 h-3" />
                        <span className="capitalize">{hoje}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h3 className={`font-semibold text-lg text-gray-900 transition-colors ${
                            !isDisabled && 'group-hover:text-primary'
                          }`}>
                            {residente.nome_completo}
                          </h3>
                        </div>
                        <div className="ml-3">
                          {getStatusBadge(statusInfo.status)}
                        </div>
                      </div>
                      
                      {/* Barra de progresso */}
                      {statusInfo.status !== 'nao_iniciado' && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Progresso do preenchimento</span>
                            <span>{statusInfo.progresso || 0}%</span>
                          </div>
                          <Progress value={statusInfo.progresso || 0} className="h-2" />
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <Button 
                          variant={isDisabled ? "secondary" : "outline"}
                          size="sm" 
                          disabled={isDisabled}
                          className={`w-full transition-colors ${
                            !isDisabled && 'group-hover:bg-primary group-hover:text-white'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDisabled) {
                              setSelectedResidente(residente.id);
                            }
                          }}
                        >
                          {getButtonText(statusInfo.status)}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <NovoFormularioProntuario 
            funcionarioId={funcionarioId} 
            residenteId={selectedResidente}
            cicloStatus={prontuariosStatus[selectedResidente]?.status || 'nao_iniciado'}
            onChangeResidente={setSelectedResidente}
            onVoltar={() => {
              setSelectedResidente(null);
              // Recarregar status quando voltar
              recarregarStatusProntuarios();
            }}
            onStatusChange={async (residenteId, status, cicloId) => {
              // Calcular progresso baseado nos campos obrigatórios preenchidos
              let progresso = 0;
              
              if (status === 'encerrado') {
                progresso = 100; // Finalizado = 100%
              } else if (status === 'nao_iniciado') {
                progresso = 0; // Não iniciado = 0%
              } else if (cicloId) {
                // Para 'em_andamento' e 'completo', calcular baseado nos campos
                progresso = await calcularProgressoBaseadoCampos(cicloId);
              }
              
              setProntuariosStatus(prev => ({
                ...prev,
                [residenteId]: { status, cicloId, progresso }
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}