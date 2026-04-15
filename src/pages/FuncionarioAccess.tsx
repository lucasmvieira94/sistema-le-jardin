import React, { useState, useEffect } from "react";
import { CalendarRange, FileHeart, Clock, User, Shield, Thermometer, Baby, CalendarDays, ClipboardList, MessageSquareHeart, Eye, FileSearch, AlertTriangle, Trophy, Pill } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import careLogo from "@/assets/logo-senex-care-new.png";

const SESSION_KEY = 'funcionario_session';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 horas em ms

interface FuncionarioSession {
  id: string;
  nome: string;
  registraPonto: boolean;
  acessoSupervisor: boolean;
  timestamp: number;
}

function saveSession(session: FuncionarioSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession(): FuncionarioSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: FuncionarioSession = JSON.parse(raw);
    if (Date.now() - session.timestamp > SESSION_DURATION) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function FuncionarioAccess() {
  const navigate = useNavigate();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(() => loadSession()?.id ?? null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>(() => loadSession()?.nome ?? '');
  const [funcionarioRegistraPonto, setFuncionarioRegistraPonto] = useState<boolean>(() => loadSession()?.registraPonto ?? true);
  const [funcionarioAcessoSupervisor, setFuncionarioAcessoSupervisor] = useState<boolean>(() => loadSession()?.acessoSupervisor ?? false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [companyName, setCompanyName] = useState<string>('Sistema de Gestão');
  const [companyLogo, setCompanyLogo] = useState<string>('');

  // Auto-expire session every minute
  useEffect(() => {
    const checkExpiry = setInterval(() => {
      const session = loadSession();
      if (!session && funcionarioId) {
        // Session expired
        setFuncionarioId(null);
        setFuncionarioNome('');
        setFuncionarioRegistraPonto(true);
        setFuncionarioAcessoSupervisor(false);
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(checkExpiry);
  }, [funcionarioId]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch company configuration
  useEffect(() => {
    const fetchCompanyConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracoes_empresa')
          .select('nome_empresa, logo_url')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar configurações da empresa:', error);
          return;
        }

        if (data) {
          setCompanyName(data.nome_empresa || 'Sistema de Gestão');
          setCompanyLogo(data.logo_url || '');
        }
      } catch (error) {
        console.error('Erro ao buscar configurações:', error);
      }
    };

    fetchCompanyConfig();
  }, []);

  const handleFuncionarioValidado = async (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
    
    let registraPonto = true;
    let acessoSupervisor = false;

    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('registra_ponto, acesso_supervisor')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Erro ao buscar dados do funcionário:', error);
      } else {
        registraPonto = data.registra_ponto;
        acessoSupervisor = (data as any).acesso_supervisor ?? false;
      }
    } catch (error) {
      console.error('Erro ao buscar funcionário:', error);
    }

    setFuncionarioRegistraPonto(registraPonto);
    setFuncionarioAcessoSupervisor(acessoSupervisor);

    // Salvar sessão com timestamp
    saveSession({
      id,
      nome,
      registraPonto,
      acessoSupervisor,
      timestamp: Date.now(),
    });
  };

  const handleLogout = () => {
    clearSession();
    setFuncionarioId(null);
    setFuncionarioNome('');
    setFuncionarioRegistraPonto(true);
    setFuncionarioAcessoSupervisor(false);
  };

  const navigateToRegistroPonto = () => {
    navigate(`/registro-ponto?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToProntuario = () => {
    navigate(`/prontuario?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToTemperatura = () => {
    navigate(`/temperatura-medicamentos?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToFraldas = () => {
    navigate(`/controle-fraldas-publico?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToMinhaEscala = () => {
    navigate(`/minha-escala?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToMeusPontos = () => {
    navigate(`/meus-pontos?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToFeedback = () => {
    navigate(`/feedback-sistema?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToSupervisor = () => {
    navigate(`/supervisor-prontuarios?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToMeusProntuarios = () => {
    navigate(`/meus-prontuarios?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToIntercorrencias = () => {
    navigate(`/intercorrencias?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToPainelIntercorrencias = () => {
    navigate(`/painel-intercorrencias?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToGamificacao = () => {
    navigate(`/gamificacao?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToAdministracaoMedicamentos = () => {
    navigate(`/administracao-medicamentos?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToAuth = () => {
    window.open('/auth', '_blank');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8 -mt-2">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt="Logo da empresa" 
                className="w-64 h-64 sm:w-96 sm:h-96 md:w-128 md:h-128 lg:w-160 lg:h-160 mx-auto mb-3 sm:mb-4 object-contain"
              />
            ) : (
              <img 
                src={careLogo} 
                alt="Logo da empresa" 
                className="w-64 h-64 sm:w-96 sm:h-96 md:w-128 md:h-128 lg:w-160 lg:h-160 mx-auto -mt-4 mb-0 object-contain"
              />
            )}
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
              {companyName}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mb-4 px-2">
              Acesse o registro de ponto e prontuário eletrônico
            </p>
          </div>
          
          <div className="text-center mb-4 sm:mb-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2 text-xs sm:text-sm">
              <CalendarRange className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="break-words">{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="text-base sm:text-lg font-medium flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>
          
          <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
          
          {/* Botão de Acesso Administrativo */}
          <div className="mt-6 text-center">
            <Button
              onClick={navigateToAuth}
              variant="outline"
              className="px-4 sm:px-6 py-2 text-sm sm:text-base border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors"
            >
              <Shield className="w-4 h-4 mr-2" />
              Acesso Administrativo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header com saudação */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4 sm:mb-6">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3">
              {companyLogo ? (
                <img 
                  src={companyLogo} 
                  alt="Logo da empresa" 
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain flex-shrink-0"
                />
              ) : (
                <img 
                  src={careLogo} 
                  alt="Logo da empresa" 
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain flex-shrink-0"
                />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 break-words">
                  {getGreeting()}, {funcionarioNome.split(' ')[0]}!
                </h1>
                <p className="text-sm sm:text-base text-gray-600">Bem-vindo(a) ao sistema</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm">
              <CalendarRange className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="break-words text-center">{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div className="text-lg sm:text-xl font-medium flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* Seleção de funcionalidade */}
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Registro de Ponto - só mostra se funcionário registra ponto */}
            {funcionarioRegistraPonto && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
                onClick={navigateToRegistroPonto}
              >
                <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <CalendarRange className="w-6 h-6 sm:w-8 sm:h-8 text-green-700" />
                  </div>
                  <CardTitle className="text-green-800 text-base sm:text-lg">Registro de Ponto</CardTitle>
                </CardHeader>
                <CardContent className="text-center p-4 sm:p-6 pt-0">
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                    Registre entrada, saída e intervalos do seu horário de trabalho
                  </p>
                  <Button 
                    className="w-full bg-green-700 hover:bg-green-800 text-sm sm:text-base py-2 sm:py-3"
                    onClick={navigateToRegistroPonto}
                  >
                    Acessar Registro
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Prontuário Eletrônico */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
              onClick={navigateToProntuario}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <FileHeart className="w-6 h-6 sm:w-8 sm:h-8 text-green-700" />
                </div>
                <CardTitle className="text-green-800 text-base sm:text-lg">Prontuário Eletrônico</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Registre atividades e observações dos residentes
                </p>
                <Button 
                  className="w-full bg-green-700 hover:bg-green-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToProntuario}
                >
                  Acessar Prontuário
                </Button>
              </CardContent>
            </Card>

            {/* Controle de Temperatura */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
              onClick={navigateToTemperatura}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Thermometer className="w-6 h-6 sm:w-8 sm:h-8 text-green-700" />
                </div>
                <CardTitle className="text-green-800 text-base sm:text-lg">Controle de Temperatura</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Registre temperatura da sala de medicamentos
                </p>
                <Button 
                  className="w-full bg-green-700 hover:bg-green-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToTemperatura}
                >
                  Registrar Temperatura
                </Button>
              </CardContent>
            </Card>

            {/* Controle de Fraldas */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
              onClick={navigateToFraldas}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Baby className="w-6 h-6 sm:w-8 sm:h-8 text-purple-700" />
                </div>
                <CardTitle className="text-purple-800 text-base sm:text-lg">Controle de Fraldas</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Registre uso e cadastre estoque de fraldas
                </p>
                <Button 
                  className="w-full bg-purple-700 hover:bg-purple-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToFraldas}
                >
                  Acessar Fraldas
                </Button>
              </CardContent>
            </Card>

            {/* Minha Escala */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
              onClick={navigateToMinhaEscala}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-teal-700" />
                </div>
                <CardTitle className="text-teal-800 text-base sm:text-lg">Minha Escala</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Veja seus dias escalados no mês corrente
                </p>
                <Button 
                  className="w-full bg-teal-700 hover:bg-teal-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToMinhaEscala}
                >
                  Ver Escala
                </Button>
              </CardContent>
            </Card>

            {/* Meus Pontos */}
            {funcionarioRegistraPonto && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
                onClick={navigateToMeusPontos}
              >
                <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-blue-700" />
                  </div>
                  <CardTitle className="text-blue-800 text-base sm:text-lg">Meus Pontos</CardTitle>
                </CardHeader>
                <CardContent className="text-center p-4 sm:p-6 pt-0">
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                    Consulte seus registros de ponto do mês anterior
                  </p>
                  <Button 
                    className="w-full bg-blue-700 hover:bg-blue-800 text-sm sm:text-base py-2 sm:py-3"
                    onClick={navigateToMeusPontos}
                  >
                    Ver Registros
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Painel do Supervisor - só mostra se tem acesso */}
            {funcionarioAcessoSupervisor && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-indigo-400"
                onClick={navigateToSupervisor}
              >
                <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-700" />
                  </div>
                  <CardTitle className="text-indigo-800 text-base sm:text-lg">Painel do Supervisor</CardTitle>
                </CardHeader>
                <CardContent className="text-center p-4 sm:p-6 pt-0">
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                    Visualize prontuários, estoques e intercorrências
                  </p>
                  <Button 
                    className="w-full bg-indigo-700 hover:bg-indigo-800 text-sm sm:text-base py-2 sm:py-3"
                    onClick={navigateToSupervisor}
                  >
                    Acessar Painel
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Meus Prontuários */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-cyan-400"
              onClick={navigateToMeusProntuarios}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <FileSearch className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-700" />
                </div>
                <CardTitle className="text-cyan-800 text-base sm:text-lg">Meus Prontuários</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Consulte os prontuários que você preencheu
                </p>
                <Button 
                  className="w-full bg-cyan-700 hover:bg-cyan-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToMeusProntuarios}
                >
                  Ver Meus Registros
                </Button>
              </CardContent>
            </Card>

            {/* Feedback do Sistema */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
              onClick={navigateToFeedback}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <MessageSquareHeart className="w-6 h-6 sm:w-8 sm:h-8 text-amber-700" />
                </div>
                <CardTitle className="text-amber-800 text-base sm:text-lg">Feedback do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Avalie e sugira melhorias para o SENEXCARE
                </p>
                <Button 
                  className="w-full bg-amber-700 hover:bg-amber-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToFeedback}
                >
                  Avaliar Sistema
                </Button>
              </CardContent>
            </Card>

            {/* Intercorrências */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-red-400"
              onClick={navigateToIntercorrencias}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-700" />
                </div>
                <CardTitle className="text-red-800 text-base sm:text-lg">Intercorrências</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Registre e acompanhe intercorrências
                </p>
                <Button 
                  className="w-full bg-red-700 hover:bg-red-800 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToIntercorrencias}
                >
                  Registrar Intercorrência
                </Button>
              </CardContent>
              </Card>

            {/* Dashboard do Supervisor - só mostra se tem acesso supervisor */}
            {funcionarioAcessoSupervisor && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-rose-400"
                onClick={navigateToPainelIntercorrencias}
              >
                <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-rose-700" />
                  </div>
                  <CardTitle className="text-rose-800 text-base sm:text-lg">Dashboard Supervisão</CardTitle>
                </CardHeader>
                <CardContent className="text-center p-4 sm:p-6 pt-0">
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                    Estoques, intercorrências e assistente IA
                  </p>
                  <Button 
                    className="w-full bg-rose-700 hover:bg-rose-800 text-sm sm:text-base py-2 sm:py-3"
                    onClick={navigateToPainelIntercorrencias}
                  >
                    Acessar Dashboard
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Meu Desempenho (Gamificação) */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-yellow-400"
              onClick={navigateToGamificacao}
            >
              <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-700" />
                </div>
                <CardTitle className="text-yellow-800 text-base sm:text-lg">Meu Desempenho</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 sm:p-6 pt-0">
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Veja seus pontos, nível e resgate prêmios
                </p>
                <Button 
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-sm sm:text-base py-2 sm:py-3"
                  onClick={navigateToGamificacao}
                >
                  Acessar Desempenho
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Botão de logout */}
          <div className="text-center mt-6 sm:mt-8 space-y-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="px-6 sm:px-8 text-sm sm:text-base"
            >
              Trocar usuário
            </Button>
            
            {/* Separador visual */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}