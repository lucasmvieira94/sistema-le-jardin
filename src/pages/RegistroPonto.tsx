
import React, { useState, useEffect } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import BotoesRegistroPonto from "@/components/BotoesRegistroPonto";
import { useGeolocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";

interface RegistroHoje {
  horario: string;
  tipo: string;
}

export default function RegistroPonto() {
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioNome, setFuncionarioNome] = useState<string>('');
  const [registrosHoje, setRegistrosHoje] = useState<RegistroHoje[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const { latitude, longitude } = useGeolocation();

  const carregarRegistrosHoje = async () => {
    if (!funcionarioId) return;
    
    setAtualizando(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
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

  const handleFuncionarioValidado = (id: string, nome: string) => {
    setFuncionarioId(id);
    setFuncionarioNome(nome);
  };

  const handleRegistroRealizado = () => {
    carregarRegistrosHoje();
  };

  const handleLogout = () => {
    setFuncionarioId(null);
    setFuncionarioNome('');
    setRegistrosHoje([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="container mx-auto max-w-md">
        <div className="bg-white rounded-2xl p-6 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-primary">Registro de Ponto</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CalendarRange className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="text-lg font-medium">
              {new Date().toLocaleTimeString('pt-BR').slice(0, 5)}
            </div>
          </div>

          {!funcionarioId ? (
            <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
          ) : (
            <>
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

              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                Usar outro código
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
