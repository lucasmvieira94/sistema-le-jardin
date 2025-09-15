
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
      const hoje = formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida')
        .eq('funcionario_id', funcionarioId)
        .eq('data', hoje)
        .single();

      if (!error && data) {
        const registros: RegistroHoje[] = [];
        if (data.entrada) registros.push({ horario: data.entrada.slice(0, 5), tipo: 'Entrada' });
        if (data.intervalo_inicio) registros.push({ horario: data.intervalo_inicio.slice(0, 5), tipo: 'Início Intervalo' });
        if (data.intervalo_fim) registros.push({ horario: data.intervalo_fim.slice(0, 5), tipo: 'Fim Intervalo' });
        if (data.saida) registros.push({ horario: data.saida.slice(0, 5), tipo: 'Saída' });
        
        setRegistrosHoje(registros);
      } else {
        setRegistrosHoje([]);
      }
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="container mx-auto max-w-md">
        <div className="bg-white rounded-2xl p-6 shadow-xl space-y-6">
          {/* Header com botão voltar */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={handleVoltar}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="text-sm text-muted-foreground">
              {funcionarioNome.split(' ')[0]}
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-primary">Registro de Ponto</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CalendarRange className="w-4 h-4" />
              <span>{currentTime.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="text-lg font-medium">
              {formatInTimeZone(currentTime, 'America/Sao_Paulo', 'HH:mm:ss')}
            </div>
          </div>

          <BotoesRegistroPonto
            funcionarioId={funcionarioId}
            funcionarioNome={funcionarioNome}
            latitude={latitude}
            longitude={longitude}
            onRegistroRealizado={handleRegistroRealizado}
          />

              {registrosHoje.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-muted-foreground">Registros de hoje</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={carregarRegistrosHoje}
                      disabled={atualizando}
                    >
                      <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="bg-green-50 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-medium text-muted-foreground bg-green-100">
                          <th className="py-2 px-3">Horário</th>
                          <th className="py-2 px-3">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrosHoje.map((registro, index) => (
                          <tr key={index} className="border-t border-green-200">
                            <td className="py-2 px-3 font-mono text-sm">{registro.horario}</td>
                            <td className="py-2 px-3 text-sm">{registro.tipo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          <div className="space-y-3">
            <Link 
              to={`/prontuario?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`}
              className="w-full"
            >
              <Button variant="default" className="w-full flex items-center gap-2">
                <FileHeart className="w-4 h-4" />
                Acessar Prontuário Eletrônico
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
