
import React, { useState, useEffect } from "react";
import { CalendarRange, RefreshCw, FileHeart, ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BotoesRegistroPonto from "@/components/BotoesRegistroPonto";
import { useGeolocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";

interface RegistroHoje {
  horario: string;
  tipo: string;
}

export default function RegistroPonto() {
  const location = useLocation();
  const navigate = useNavigate();
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>('');
  const [registrosHoje, setRegistrosHoje] = useState<RegistroHoje[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { latitude, longitude } = useGeolocation();

  // Receber dados do funcionário via URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const funcId = searchParams.get('funcionario_id');
    const funcNome = searchParams.get('funcionario_nome');
    
    if (funcId && funcNome) {
      setFuncionarioId(funcId);
      setFuncionarioNome(decodeURIComponent(funcNome));
    } else {
      // Se não tem dados na URL, redireciona para a página de acesso
      navigate('/funcionario-access');
    }
  }, [location, navigate]);

  const carregarRegistrosHoje = async () => {
    if (!funcionarioId) return;
    
    setAtualizando(true);
    try {
      const agora = new Date();
      const hoje = formatInTimeZone(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
      const ontem = formatInTimeZone(new Date(agora.getTime() - 24*60*60*1000), 'America/Sao_Paulo', 'yyyy-MM-dd');
      
      // Primeiro, verifica se existe registro de HOJE
      const { data: registroHoje, error: errorHoje } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida')
        .eq('funcionario_id', funcionarioId)
        .eq('data', hoje)
        .single();

      if (!errorHoje && registroHoje) {
        const registros: RegistroHoje[] = [];
        if (registroHoje.entrada) registros.push({ horario: registroHoje.entrada.slice(0, 5), tipo: 'Entrada' });
        if (registroHoje.intervalo_inicio) registros.push({ horario: registroHoje.intervalo_inicio.slice(0, 5), tipo: 'Início Intervalo' });
        if (registroHoje.intervalo_fim) registros.push({ horario: registroHoje.intervalo_fim.slice(0, 5), tipo: 'Fim Intervalo' });
        if (registroHoje.saida) registros.push({ horario: registroHoje.saida.slice(0, 5), tipo: 'Saída' });
        
        setRegistrosHoje(registros);
        return;
      }

      // Se não há registro hoje, verifica se há registro de ONTEM sem saída (turno noturno)
      const { data: registroOntem, error: errorOntem } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida')
        .eq('funcionario_id', funcionarioId)
        .eq('data', ontem)
        .is('saida', null)
        .single();

      if (!errorOntem && registroOntem && registroOntem.entrada) {
        const registros: RegistroHoje[] = [];
        if (registroOntem.entrada) registros.push({ horario: registroOntem.entrada.slice(0, 5), tipo: 'Entrada (ontem)' });
        if (registroOntem.intervalo_inicio) registros.push({ horario: registroOntem.intervalo_inicio.slice(0, 5), tipo: 'Início Intervalo' });
        if (registroOntem.intervalo_fim) registros.push({ horario: registroOntem.intervalo_fim.slice(0, 5), tipo: 'Fim Intervalo' });
        
        setRegistrosHoje(registros);
        return;
      }

      setRegistrosHoje([]);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      setRegistrosHoje([]);
    } finally {
      setAtualizando(false);
    }
  };

  useEffect(() => {
    if (funcionarioId) {
      carregarRegistrosHoje();
    }
  }, [funcionarioId]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRegistroRealizado = () => {
    carregarRegistrosHoje();
  };

  const handleVoltar = () => {
    navigate('/funcionario-access');
  };

  // Se não tem funcionário ID, não renderiza nada (vai redirecionar)
  if (!funcionarioId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex flex-col">
      {/* Header fixo */}
      <header className="bg-background/95 backdrop-blur-sm shadow-sm px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleVoltar} className="text-muted-foreground hover:text-foreground p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="text-sm font-medium text-foreground">
          {funcionarioNome.split(' ')[0]}
        </div>
        <div className="w-9" /> {/* Spacer para centralizar o nome */}
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col p-4 pb-8">
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Card de horário */}
          <div className="bg-background rounded-2xl shadow-xl p-6 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-2">
              <CalendarRange className="w-4 h-4" />
              <span className="capitalize">{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'short', 
                day: 'numeric',
                month: 'short'
              })}</span>
            </div>
            <div className="text-4xl md:text-5xl font-mono font-bold text-primary tracking-tight">
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>

          {/* Botões de registro */}
          <div className="bg-background rounded-2xl shadow-xl p-6 mb-6">
            <BotoesRegistroPonto
              funcionarioId={funcionarioId}
              funcionarioNome={funcionarioNome}
              latitude={latitude}
              longitude={longitude}
              onRegistroRealizado={handleRegistroRealizado}
            />
          </div>

          {/* Registros de hoje */}
          {registrosHoje.length > 0 && (
            <div className="bg-background rounded-2xl shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground text-sm">Registros de hoje</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={carregarRegistrosHoje}
                  disabled={atualizando}
                  className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                >
                  <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {registrosHoje.map((registro, index) => (
                  <div 
                    key={index} 
                    className="bg-muted/50 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-mono text-sm font-bold text-primary">{registro.horario}</p>
                      <p className="text-xs text-muted-foreground">{registro.tipo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer fixo */}
      <footer className="bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3">
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-2 h-12 font-semibold"
          onClick={handleVoltar}
        >
          <ArrowLeft className="w-5 h-5" />
          Trocar usuário
        </Button>
      </footer>
    </div>
  );
}
