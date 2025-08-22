import { useState } from "react";
import { useLocation } from "react-router-dom";
import { FileHeart, UserPlus, CheckCircle, Clock, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import NovoFormularioProntuario from "@/components/prontuario/NovoFormularioProntuario";
import ResidentesList from "@/components/prontuario/ResidentesList";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";

export default function Prontuario() {
  const location = useLocation();
  const { toast } = useToast();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [selectedResidente, setSelectedResidente] = useState<string | null>(null);
  const [residentes, setResidentes] = useState<any[]>([]);
  const [prontuariosStatus, setProntuariosStatus] = useState<Record<string, {status: string, cicloId: string | null}>>({});

  // Verificar se já tem dados do funcionário na URL (vindos do registro de ponto)
  useState(() => {
    const searchParams = new URLSearchParams(location.search);
    const funcId = searchParams.get('funcionario_id');
    const funcNome = searchParams.get('funcionario_nome');
    
    if (funcId && funcNome) {
      setFuncionarioId(funcId);
      setFuncionarioNome(decodeURIComponent(funcNome));
    }
  });

  const verificarStatusProntuarios = async (residentesData: any[]) => {
    const statusMap: Record<string, {status: string, cicloId: string | null}> = {};
    
    for (const residente of residentesData) {
      try {
        const { data: verificacao, error } = await supabase
          .rpc('verificar_prontuario_diario_existente', { 
            p_residente_id: residente.id 
          });

        if (!error && verificacao?.[0]?.ja_iniciado) {
          const cicloInfo = verificacao[0];
          statusMap[residente.id] = {
            status: cicloInfo.status,
            cicloId: cicloInfo.ciclo_id
          };
        } else {
          statusMap[residente.id] = {
            status: 'nao_iniciado',
            cicloId: null
          };
        }
      } catch (err) {
        console.error('Erro ao verificar status do prontuário:', err);
        statusMap[residente.id] = {
          status: 'nao_iniciado',
          cicloId: null
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

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome("");
    setSelectedResidente(null);
    setResidentes([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'nao_iniciado':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <FileX className="w-3 h-3" />
            Não Iniciado
          </Badge>
        );
      case 'em_andamento':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Em Andamento
          </Badge>
        );
      case 'encerrado':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-600 text-white">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
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
      case 'encerrado':
        return 'Ver Prontuário';
      default:
        return 'Iniciar Prontuário';
    }
  };

  const isButtonDisabled = (status: string) => {
    return status === 'encerrado';
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <FileHeart className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Sistema de Prontuário Eletrônico
            </h1>
            <p className="text-gray-600">
              Registre atividades e observações dos residentes
            </p>
          </div>
          
          <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileHeart className="w-6 h-6 text-primary" />
                Prontuário Eletrônico
              </h1>
              <p className="text-sm text-muted-foreground">
                {funcionarioNome}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              Trocar usuário
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {!selectedResidente ? (
          <div className="space-y-6">
            <div className="text-center">
              <UserPlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Selecione um residente</h2>
              <p className="text-muted-foreground">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                {residentes.map((residente) => {
                  const statusInfo = prontuariosStatus[residente.id] || { status: 'nao_iniciado', cicloId: null };
                  const isDisabled = isButtonDisabled(statusInfo.status);
                  
                  return (
                    <div
                      key={residente.id}
                      onClick={() => !isDisabled && setSelectedResidente(residente.id)}
                      className={`p-6 bg-white rounded-lg border border-gray-200 transition-all ${
                        isDisabled 
                          ? 'cursor-not-allowed opacity-70' 
                          : 'hover:border-primary hover:shadow-md cursor-pointer'
                      } group`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className={`font-semibold text-lg text-gray-900 transition-colors ${
                            !isDisabled && 'group-hover:text-primary'
                          }`}>
                            {residente.nome_completo}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Prontuário: {residente.numero_prontuario}
                          </p>
                        </div>
                        <UserPlus className={`w-5 h-5 text-gray-400 transition-colors ${
                          !isDisabled && 'group-hover:text-primary'
                        }`} />
                      </div>
                      
                      {/* Status do Prontuário */}
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Status do Prontuário de Hoje:</p>
                        {getStatusBadge(statusInfo.status)}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Quarto:</span>
                          <span className="font-medium">{residente.quarto || 'N/A'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Idade:</span>
                          <span className="font-medium">
                            {new Date().getFullYear() - new Date(residente.data_nascimento).getFullYear()} anos
                          </span>
                        </div>
                        
                        {residente.responsavel_nome && (
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500">Responsável:</p>
                            <p className="text-sm font-medium text-gray-700">{residente.responsavel_nome}</p>
                            {residente.responsavel_telefone && (
                              <p className="text-xs text-gray-500">{residente.responsavel_telefone}</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-100">
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
            onVoltar={() => setSelectedResidente(null)}
            onStatusChange={(residenteId, status, cicloId) => {
              setProntuariosStatus(prev => ({
                ...prev,
                [residenteId]: { status, cicloId }
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}