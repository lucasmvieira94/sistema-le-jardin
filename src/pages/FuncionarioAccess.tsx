import React, { useState, useEffect } from "react";
import { CalendarRange, FileHeart, Clock, User, Shield, Thermometer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import careLogo from "@/assets/logo-senex-care-main.png";

export default function FuncionarioAccess() {
  const navigate = useNavigate();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>('');
  const [funcionarioRegistraPonto, setFuncionarioRegistraPonto] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [companyName, setCompanyName] = useState<string>('Sistema de Gestão');
  const [companyLogo, setCompanyLogo] = useState<string>('');

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
    
    // Buscar se o funcionário registra ponto
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('registra_ponto')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Erro ao buscar dados do funcionário:', error);
        setFuncionarioRegistraPonto(true); // default
      } else {
        setFuncionarioRegistraPonto(data.registra_ponto);
      }
    } catch (error) {
      console.error('Erro ao buscar funcionário:', error);
      setFuncionarioRegistraPonto(true); // default
    }
  };

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome('');
    setFuncionarioRegistraPonto(true);
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
          
          <div className={`grid ${funcionarioRegistraPonto ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4`}>
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