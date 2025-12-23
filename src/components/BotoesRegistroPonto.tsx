import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, PauseCircle, RotateCcw, Loader2, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatInTimeZone } from 'date-fns-tz';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BotoesRegistroPontoProps {
  funcionarioId: string;
  funcionarioNome: string;
  latitude: number | null;
  longitude: number | null;
  onRegistroRealizado: () => void;
}

type TipoRegistro = 'entrada' | 'intervalo_inicio' | 'intervalo_fim' | 'saida';

interface RegistroStatus {
  temEntrada: boolean;
  temIntervaloInicio: boolean;
  temIntervaloFim: boolean;
  temSaida: boolean;
}

function traduzirErro(error: any): string {
  if (!error) return "Erro desconhecido ao registrar ponto.";
  if (typeof error === "string") return error;

  if (error.message) {
    if (error.message.includes("duplicate key value")) {
      return "Já existe um registro de ponto para este horário.";
    }
    if (error.message.includes("permission denied") || error.message.includes("not authorized")) {
      return "Você não tem permissão para registrar este ponto.";
    }
    if (error.message.includes("null value in column")) {
      return "Informações obrigatórias não foram preenchidas.";
    }
    if (error.message.includes("latitude") || error.message.includes("longitude")) {
      return "Falha ao registrar a localização. Permita o acesso ao GPS.";
    }
    return error.message;
  }

  if (error.error_description) return error.error_description;
  return "Erro ao registrar ponto. Tente novamente.";
}

export default function BotoesRegistroPonto({ 
  funcionarioId, 
  funcionarioNome, 
  latitude, 
  longitude,
  onRegistroRealizado 
}: BotoesRegistroPontoProps) {
  const navigate = useNavigate();
  const [registrando, setRegistrando] = useState<TipoRegistro | null>(null);
  const [status, setStatus] = useState<RegistroStatus>({
    temEntrada: false,
    temIntervaloInicio: false,
    temIntervaloFim: false,
    temSaida: false
  });
  const [alertaAberto, setAlertaAberto] = useState(false);
  const [alertaInfo, setAlertaInfo] = useState({ tipo: '', horario: '' });
  const { logEvent } = useAuditLog();

  // Função para fechar alerta e voltar à tela inicial
  const handleConfirmarAlerta = () => {
    setAlertaAberto(false);
    navigate('/funcionario-access');
  };

  // Carregar status atual dos registros
  const carregarStatus = async () => {
    try {
      const hoje = formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      const { data } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida')
        .eq('funcionario_id', funcionarioId)
        .eq('data', hoje)
        .single();

      if (data) {
        setStatus({
          temEntrada: !!data.entrada,
          temIntervaloInicio: !!data.intervalo_inicio,
          temIntervaloFim: !!data.intervalo_fim,
          temSaida: !!data.saida
        });
      } else {
        setStatus({
          temEntrada: false,
          temIntervaloInicio: false,
          temIntervaloFim: false,
          temSaida: false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  useEffect(() => {
    if (funcionarioId) {
      carregarStatus();
    }
  }, [funcionarioId]);

  const registrarPonto = async (tipo: TipoRegistro) => {
    setRegistrando(tipo);
    
    try {
      const agora = new Date();
      const data = formatInTimeZone(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
      const horario = formatInTimeZone(agora, 'America/Sao_Paulo', 'HH:mm:ss');
      
      let dataReferencia = data;
      let registroExistente = null;
      let errorBusca = null;
      
      if (tipo === 'entrada') {
        const { data: registro, error } = await supabase
          .from('registros_ponto')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .eq('data', data)
          .single();
        
        registroExistente = registro;
        errorBusca = error;
      } else {
        const { data: registro, error } = await supabase
          .from('registros_ponto')
          .select('*')
          .eq('funcionario_id', funcionarioId)
          .or(`data.eq.${data},data.eq.${formatInTimeZone(new Date(Date.now() - 24*60*60*1000), 'America/Sao_Paulo', 'yyyy-MM-dd')}`)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        registroExistente = registro;
        errorBusca = error;
        
        if (registroExistente) {
          dataReferencia = registroExistente.data;
        }
      }

      if (errorBusca && errorBusca.code !== 'PGRST116') {
        throw errorBusca;
      }

      let updateData: any = {
        latitude: latitude || null,
        longitude: longitude || null,
      };

      switch (tipo) {
        case 'entrada':
          updateData.entrada = horario;
          break;
        case 'intervalo_inicio':
          updateData.intervalo_inicio = horario;
          break;
        case 'intervalo_fim':
          updateData.intervalo_fim = horario;
          break;
        case 'saida':
          updateData.saida = horario;
          if (registroExistente?.entrada && !registroExistente.intervalo_inicio) {
            try {
              const { data: intervalos } = await supabase.rpc('inserir_intervalo_automatico', {
                p_funcionario_id: funcionarioId,
                p_data: dataReferencia,
                p_entrada: registroExistente.entrada,
                p_saida: horario
              });
              
              if (intervalos && intervalos.length > 0) {
                const intervalo = intervalos[0];
                if (intervalo.intervalo_inicio && intervalo.intervalo_fim) {
                  updateData.intervalo_inicio = intervalo.intervalo_inicio;
                  updateData.intervalo_fim = intervalo.intervalo_fim;
                }
              }
            } catch (intervalError) {
              console.warn('Erro ao inserir intervalo automático:', intervalError);
            }
          }
          break;
      }

      if (registroExistente) {
        await logEvent('registros_ponto', 'UPDATE', registroExistente, updateData);
        
        const { error } = await supabase
          .from('registros_ponto')
          .update(updateData)
          .eq('id', registroExistente.id);

        if (error) throw error;
      } else {
        const newRecord = {
          funcionario_id: funcionarioId,
          data: dataReferencia,
          ...updateData,
        };
        
        await logEvent('registros_ponto', 'INSERT', null, newRecord);
        
        const { error } = await supabase
          .from('registros_ponto')
          .insert(newRecord);

        if (error) throw error;
      }

      const tipoNomes: Record<TipoRegistro, string> = {
        entrada: 'Entrada',
        intervalo_inicio: 'Início do Intervalo',
        intervalo_fim: 'Fim do Intervalo',
        saida: 'Saída'
      };

      // Mostrar alerta de confirmação
      setAlertaInfo({
        tipo: tipoNomes[tipo],
        horario: horario.slice(0, 5)
      });
      setAlertaAberto(true);

      await carregarStatus();
      onRegistroRealizado();
    } catch (error: any) {
      console.error('Erro ao registrar ponto:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: traduzirErro(error)
      });
    } finally {
      setRegistrando(null);
    }
  };

  // Determinar qual é o próximo registro principal (entrada ou saída)
  const getProximoRegistroPrincipal = () => {
    if (!status.temEntrada) {
      return { tipo: 'entrada' as TipoRegistro, label: 'REGISTRAR ENTRADA', icon: LogIn };
    }
    if (!status.temSaida) {
      return { tipo: 'saida' as TipoRegistro, label: 'REGISTRAR SAÍDA', icon: LogOut };
    }
    return null;
  };

  const proximoPrincipal = getProximoRegistroPrincipal();
  const mostrarIntervalos = status.temEntrada && !status.temSaida;

  return (
    <div className="space-y-6">
      {/* Botão Principal de Entrada/Saída */}
      {proximoPrincipal && (
        <Button
          onClick={() => registrarPonto(proximoPrincipal.tipo)}
          disabled={registrando !== null}
          className={`w-full h-20 text-xl font-bold shadow-lg transition-all ${
            proximoPrincipal.tipo === 'entrada' 
              ? 'bg-primary hover:bg-primary/90' 
              : 'bg-destructive hover:bg-destructive/90'
          }`}
          size="lg"
        >
          {registrando === proximoPrincipal.tipo ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>Registrando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <proximoPrincipal.icon className="w-7 h-7" />
              <span>{proximoPrincipal.label}</span>
            </div>
          )}
        </Button>
      )}

      {/* Jornada completa */}
      {status.temSaida && (
        <div className="text-center p-6 bg-primary/10 rounded-xl border border-primary/20">
          <Check className="w-12 h-12 text-primary mx-auto mb-2" />
          <p className="text-lg font-semibold text-primary">Jornada Completa!</p>
          <p className="text-sm text-muted-foreground">Todos os registros do dia foram feitos.</p>
        </div>
      )}

      {/* Botões de Intervalo (só aparecem após entrada e antes da saída) */}
      {mostrarIntervalos && (
        <div className="space-y-3">
          <p className="text-sm text-center text-muted-foreground font-medium">
            Registros de Intervalo
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => registrarPonto('intervalo_inicio')}
              disabled={registrando !== null || status.temIntervaloInicio}
              className={`h-14 text-sm font-semibold ${
                status.temIntervaloInicio 
                  ? 'bg-muted text-muted-foreground' 
                  : 'bg-accent text-accent-foreground hover:bg-accent/90'
              }`}
              variant={status.temIntervaloInicio ? "outline" : "default"}
            >
              {registrando === 'intervalo_inicio' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : status.temIntervaloInicio ? (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Iniciado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <PauseCircle className="w-5 h-5" />
                  <span>Início Intervalo</span>
                </div>
              )}
            </Button>
            
            <Button
              onClick={() => registrarPonto('intervalo_fim')}
              disabled={registrando !== null || !status.temIntervaloInicio || status.temIntervaloFim}
              className={`h-14 text-sm font-semibold ${
                status.temIntervaloFim 
                  ? 'bg-muted text-muted-foreground' 
                  : !status.temIntervaloInicio 
                    ? 'bg-muted/50 text-muted-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
              }`}
              variant={status.temIntervaloFim ? "outline" : "default"}
            >
              {registrando === 'intervalo_fim' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : status.temIntervaloFim ? (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Finalizado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  <span>Fim Intervalo</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Alerta de Confirmação */}
      <AlertDialog open={alertaAberto} onOpenChange={setAlertaAberto}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">
              {alertaInfo.tipo} Registrada!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Horário: <span className="font-bold text-primary">{alertaInfo.horario}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className="w-full sm:w-auto" onClick={handleConfirmarAlerta}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
