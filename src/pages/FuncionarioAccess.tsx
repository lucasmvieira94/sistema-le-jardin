import React, { useState, useEffect } from "react";
import { CalendarRange, FileHeart, Clock, User, Shield, Thermometer, Baby, CalendarDays, ClipboardList, MessageSquareHeart, Eye, FileSearch, AlertTriangle, Trophy, Pill, Syringe, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import careLogo from "@/assets/logo-senex-care-new.png";
import PainelLembretes from "@/components/lembretes/PainelLembretes";
import ChatLembretes from "@/components/lembretes/ChatLembretes";
import ValidacaoBiometricaDialog from "@/components/biometria/ValidacaoBiometricaDialog";
import { toast } from "@/components/ui/use-toast";

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
  // Estado para validação biométrica após PIN
  const [pendingBiometria, setPendingBiometria] = useState<null | {
    id: string;
    nome: string;
    registraPonto: boolean;
    acessoSupervisor: boolean;
  }>(null);
  const [biometriaOpen, setBiometriaOpen] = useState(false);

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
    let registraPonto = true;
    let acessoSupervisor = false;
    let temBiometria = false;

    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('registra_ponto, acesso_supervisor, biometria_facial')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Erro ao buscar dados do funcionário:', error);
      } else {
        registraPonto = data.registra_ponto;
        acessoSupervisor = (data as any).acesso_supervisor ?? false;
        temBiometria = !!(data as any).biometria_facial;
      }
    } catch (error) {
      console.error('Erro ao buscar funcionário:', error);
    }

    // Se possui biometria cadastrada, exige validação facial antes de liberar a sessão
    if (temBiometria) {
      setPendingBiometria({ id, nome, registraPonto, acessoSupervisor });
      setBiometriaOpen(true);
      return;
    }

    // Sem biometria cadastrada — libera direto (compatibilidade)
    setFuncionarioId(id);
    setFuncionarioNome(nome);
    setFuncionarioRegistraPonto(registraPonto);
    setFuncionarioAcessoSupervisor(acessoSupervisor);
    saveSession({
      id,
      nome,
      registraPonto,
      acessoSupervisor,
      timestamp: Date.now(),
    });
  };

  const concluirLoginAposBiometria = () => {
    if (!pendingBiometria) return;
    const { id, nome, registraPonto, acessoSupervisor } = pendingBiometria;
    setFuncionarioId(id);
    setFuncionarioNome(nome);
    setFuncionarioRegistraPonto(registraPonto);
    setFuncionarioAcessoSupervisor(acessoSupervisor);
    saveSession({ id, nome, registraPonto, acessoSupervisor, timestamp: Date.now() });
    setPendingBiometria(null);
  };

  const cancelarLogin = () => {
    setPendingBiometria(null);
    toast({
      variant: 'destructive',
      title: 'Acesso negado',
      description: 'Validação biométrica é obrigatória para este funcionário.',
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

  const navigateToVacinas = () => {
    navigate(`/controle-vacinas-publico?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToContracheques = () => {
    navigate(`/meus-contracheques?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToMinhasFolhasPonto = () => {
    navigate(`/minhas-folhas-ponto?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
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
      <>
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8 -mt-2">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt={`Logo ${companyName}`} 
                className="w-64 h-64 sm:w-96 sm:h-96 md:w-128 md:h-128 lg:w-160 lg:h-160 mx-auto mb-3 sm:mb-4 object-contain"
              />
            ) : (
              <img 
                src={careLogo} 
                alt={`Logo ${companyName} — SenexCare`} 
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
      {pendingBiometria && (
        <ValidacaoBiometricaDialog
          open={biometriaOpen}
          onOpenChange={setBiometriaOpen}
          funcionarioId={pendingBiometria.id}
          funcionarioNome={pendingBiometria.nome}
          contexto="login_portal"
          onValidado={concluirLoginAposBiometria}
          onCancelado={cancelarLogin}
        />
      )}
      </>
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
                  alt={`Logo ${companyName}`} 
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain flex-shrink-0"
                />
              ) : (
                <img 
                  src={careLogo} 
                  alt={`Logo ${companyName} — SenexCare`} 
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 object-contain flex-shrink-0"
                />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 break-words">
                  Portal do Cuidador
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  {getGreeting()}, {funcionarioNome.split(' ')[0]}! Bem-vindo(a) ao sistema
                </p>
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
        <div className="space-y-6">
          {/* Painel de lembretes do agente IA */}
          <PainelLembretes
            funcionarioId={funcionarioId}
            funcionarioNome={funcionarioNome}
            onAcaoLembrete={(tipo) => {
              if (tipo.startsWith("ponto_")) navigateToRegistroPonto();
              else if (tipo.startsWith("prontuario_")) navigateToProntuario();
              else if (tipo === "medicamento_horario") navigateToAdministracaoMedicamentos();
            }}
          />

          {/* A. PRINCIPAIS — uso diário */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-1 w-8 bg-green-300 rounded-full" />
              <h2 className="text-white text-sm sm:text-base font-semibold uppercase tracking-wider">Principais</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {funcionarioRegistraPonto && (
                <FeatureCard title="Registro de Ponto" description="Entrada, saída e intervalos" icon={CalendarRange} color="green" buttonLabel="Registrar" onClick={navigateToRegistroPonto} featured />
              )}
              <FeatureCard title="Prontuário Eletrônico" description="Atividades dos residentes" icon={FileHeart} color="green" buttonLabel="Acessar" onClick={navigateToProntuario} featured />
              <FeatureCard title="Controle de Temperatura" description="Sala de medicamentos" icon={Thermometer} color="green" buttonLabel="Registrar" onClick={navigateToTemperatura} featured />
              <FeatureCard title="Intercorrências" description="Registre e acompanhe" icon={AlertTriangle} color="red" buttonLabel="Registrar" onClick={navigateToIntercorrencias} featured />
            </div>
          </section>

          {/* B1. MEU RH */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-1 w-8 bg-blue-300 rounded-full" />
              <h2 className="text-white text-sm sm:text-base font-semibold uppercase tracking-wider">Meu RH</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {funcionarioRegistraPonto && (
                <FeatureCard title="Minhas Folhas de Ponto" description="Folhas mensais publicadas pelo gestor" icon={Clock} color="blue" buttonLabel="Ver Folhas" onClick={navigateToMinhasFolhasPonto} />
              )}
              <FeatureCard title="Minha Escala" description="Seus dias escalados no mês" icon={CalendarDays} color="teal" buttonLabel="Ver Escala" onClick={navigateToMinhaEscala} />
              <FeatureCard title="Meus Contracheques" description="Baixe seus holerites por mês" icon={Receipt} color="emerald" buttonLabel="Ver Contracheques" onClick={navigateToContracheques} />
              <FeatureCard title="Meu Desempenho" description="Pontos, nível e prêmios" icon={Trophy} color="yellow" buttonLabel="Ver Desempenho" onClick={navigateToGamificacao} />
            </div>
          </section>

          {/* B2. RESIDENTES */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-1 w-8 bg-purple-300 rounded-full" />
              <h2 className="text-white text-sm sm:text-base font-semibold uppercase tracking-wider">Residentes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <FeatureCard title="Meus Prontuários" description="Prontuários que você preencheu" icon={FileSearch} color="cyan" buttonLabel="Ver Registros" onClick={navigateToMeusProntuarios} />
              <FeatureCard title="Controle de Fraldas" description="Uso e estoque de fraldas" icon={Baby} color="purple" buttonLabel="Acessar" onClick={navigateToFraldas} />
              <FeatureCard title="Medicamentos" description="Administração e confirmação" icon={Pill} color="orange" buttonLabel="Administrar" onClick={navigateToAdministracaoMedicamentos} />
              <FeatureCard title="Cartão Vacinal" description="Consulte e registre vacinas" icon={Syringe} color="pink" buttonLabel="Acessar" onClick={navigateToVacinas} />
            </div>
          </section>

          {/* D. PAINEL DO SUPERVISOR (unificado) */}
          {funcionarioAcessoSupervisor && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="h-1 w-8 bg-indigo-300 rounded-full" />
                <h2 className="text-white text-sm sm:text-base font-semibold uppercase tracking-wider">Supervisão</h2>
              </div>
              <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-[0.99] sm:hover:scale-[1.01] border-2 hover:border-indigo-400 bg-gradient-to-br from-indigo-50 to-white" onClick={navigateToPainelIntercorrencias}>
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Eye className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-indigo-800 text-base sm:text-lg mb-1">Painel do Supervisor</CardTitle>
                      <p className="text-gray-600 text-sm sm:text-base">Prontuários da equipe, estoques, intercorrências e assistente IA</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="w-full bg-indigo-700 hover:bg-indigo-800 text-sm sm:text-base py-2 sm:py-3" onClick={(e) => { e.stopPropagation(); navigateToPainelIntercorrencias(); }}>
                      Dashboard Operacional
                    </Button>
                    <Button variant="outline" className="w-full border-indigo-700 text-indigo-700 hover:bg-indigo-50 text-sm sm:text-base py-2 sm:py-3" onClick={(e) => { e.stopPropagation(); navigateToSupervisor(); }}>
                      Prontuários da Equipe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* C. Menos importante */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-1 w-8 bg-amber-300 rounded-full" />
              <h2 className="text-white/80 text-xs sm:text-sm font-medium uppercase tracking-wider">Outros</h2>
            </div>
            <FeatureCard title="Feedback do Sistema" description="Avalie e sugira melhorias para o SENEXCARE" icon={MessageSquareHeart} color="amber" buttonLabel="Avaliar" onClick={navigateToFeedback} />
          </section>


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
      {/* Chat IA flutuante */}
      <ChatLembretes funcionarioId={funcionarioId} />
    </div>
  );
}