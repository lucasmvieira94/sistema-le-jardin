import React, { useState, useEffect } from "react";
import { CalendarRange, FileHeart, Clock, User, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import careLogo from "@/assets/logo-senex-care-new.png";

export default function FuncionarioAccess() {
  const navigate = useNavigate();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>('');
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
          .single();

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

  const handleFuncionarioValidado = (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
  };

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome('');
  };

  const navigateToRegistroPonto = () => {
    navigate(`/registro-ponto?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToProntuario = () => {
    navigate(`/prontuario?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const navigateToAuth = () => {
    navigate('/auth');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (!funcionarioId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt="Logo da empresa" 
                className="w-80 h-80 mx-auto mb-4 object-contain"
              />
            ) : (
              <img 
                src={careLogo} 
                alt="Logo da empresa" 
                className="w-80 h-80 mx-auto mb-4 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {companyName}
            </h1>
            <p className="text-gray-600 mb-4">
              Acesse o registro de ponto e prontuário eletrônico
            </p>
            
            {/* Botão de Acesso Administrativo - Proeminente */}
            <div className="mb-4">
              <Button
                onClick={navigateToAuth}
                variant="outline"
                className="px-6 py-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
              >
                <Shield className="w-4 h-4 mr-2" />
                Acesso Administrativo
              </Button>
            </div>
          </div>
          
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              <CalendarRange className="w-4 h-4" />
              <span>{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="text-lg font-medium flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>
          
          <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header com saudação */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              {companyLogo ? (
                <img 
                  src={companyLogo} 
                  alt="Logo da empresa" 
                  className="w-40 h-40 object-contain"
                />
              ) : (
                <img 
                  src={careLogo} 
                  alt="Logo da empresa" 
                  className="w-40 h-40 object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  {getGreeting()}, {funcionarioNome.split(' ')[0]}!
                </h1>
                <p className="text-gray-600">Bem-vindo(a) ao sistema</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CalendarRange className="w-4 h-4" />
              <span>{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div className="text-xl font-medium flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* Seleção de funcionalidade */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
            Escolha a funcionalidade que deseja acessar:
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registro de Ponto */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-green-300"
              onClick={navigateToRegistroPonto}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarRange className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-green-700">Registro de Ponto</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  Registre entrada, saída e intervalos do seu horário de trabalho
                </p>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={navigateToRegistroPonto}
                >
                  Acessar Registro
                </Button>
              </CardContent>
            </Card>

            {/* Prontuário Eletrônico */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-blue-300"
              onClick={navigateToProntuario}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileHeart className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-blue-700">Prontuário Eletrônico</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  Registre atividades e observações dos residentes
                </p>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={navigateToProntuario}
                >
                  Acessar Prontuário
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Botão de logout */}
          <div className="text-center mt-8 space-y-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="px-8"
            >
              Usar outro código
            </Button>
            
            {/* Separador visual */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gradient-to-br from-blue-50 to-indigo-100 px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>
            
            {/* Botão de login do gestor */}
            <div className="text-center">
              <Button
                onClick={navigateToAuth}
                className="px-8 bg-primary hover:bg-primary/90"
              >
                <Shield className="w-4 h-4 mr-2" />
                Acesso Administrativo
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Área exclusiva para gestores
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}