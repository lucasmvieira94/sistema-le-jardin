import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, PauseCircle, PlayCircle, Loader2, Check, MapPinOff, Coffee } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatInTimeZone } from 'date-fns-tz';
import { validarGeofence, type GeofenceConfig } from '@/utils/geofence';
import ValidacaoBiometricaDialog from '@/components/biometria/ValidacaoBiometricaDialog';
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

type TipoRegistro = 'entrada' | 'pausa_inicio' | 'pausa_fim' | 'saida';

interface Pausa {
  inicio: string;
  fim?: string | null;
}

interface RegistroStatus {
  temEntrada: boolean;
  temSaida: boolean;
  pausas: Pausa[];
  pausaAberta: boolean;
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
    temSaida: false,
    pausas: [],
    pausaAberta: false,
  });
  const [alertaAberto, setAlertaAberto] = useState(false);
  const [alertaInfo, setAlertaInfo] = useState({ tipo: '', horario: '' });
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceConfig | null>(null);
  const [biometriaOpen, setBiometriaOpen] = useState(false);
  const [tipoPendente, setTipoPendente] = useState<TipoRegistro | null>(null);
  const [temBiometriaCadastrada, setTemBiometriaCadastrada] = useState<boolean | null>(null);
  const [intervaloPreAssinalado, setIntervaloPreAssinalado] = useState<boolean>(false);
  const { logEvent } = useAuditLog();

  // Função para fechar alerta e voltar à tela inicial
  const handleConfirmarAlerta = () => {
    setAlertaAberto(false);
    navigate('/funcionario-access');
  };

  // Helpers para pausas (múltiplos intervalos)
  const parsePausas = (raw: any): Pausa[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as Pausa[];
    try { return JSON.parse(raw) as Pausa[]; } catch { return []; }
  };

  const calcularTotalPausas = (pausas: Pausa[]): string => {
    let totalSeg = 0;
    for (const p of pausas) {
      if (!p.inicio || !p.fim) continue;
      const [ih, im, is] = p.inicio.split(':').map(Number);
      const [fh, fm, fs] = p.fim.split(':').map(Number);
      let diff = (fh * 3600 + fm * 60 + (fs || 0)) - (ih * 3600 + im * 60 + (is || 0));
      if (diff < 0) diff += 24 * 3600; // cruza meia-noite
      totalSeg += diff;
    }
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  // Carregar status atual dos registros (considera turnos noturnos que cruzam a meia-noite)
  const carregarStatus = async () => {
    try {
      const agora = new Date();
      const hoje = formatInTimeZone(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
      const ontem = formatInTimeZone(new Date(agora.getTime() - 24*60*60*1000), 'America/Sao_Paulo', 'yyyy-MM-dd');
      
      // Primeiro, verifica se existe registro de HOJE
      const { data: registroHoje } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida, intervalos_pausas')
        .eq('funcionario_id', funcionarioId)
        .eq('data', hoje)
        .single();

      if (registroHoje) {
        const pausas = parsePausas((registroHoje as any).intervalos_pausas);
        setStatus({
          temEntrada: !!registroHoje.entrada,
          temSaida: !!registroHoje.saida,
          pausas,
          pausaAberta: pausas.some((p) => p.inicio && !p.fim),
        });
        return;
      }

      // Se não há registro hoje, verifica se há registro de ONTEM sem saída (turno noturno)
      const { data: registroOntem } = await supabase
        .from('registros_ponto')
        .select('entrada, intervalo_inicio, intervalo_fim, saida, intervalos_pausas')
        .eq('funcionario_id', funcionarioId)
        .eq('data', ontem)
        .is('saida', null)
        .single();

      if (registroOntem && registroOntem.entrada) {
        // Existe um turno aberto de ontem - mostrar como se tivesse entrada
        const pausas = parsePausas((registroOntem as any).intervalos_pausas);
        setStatus({
          temEntrada: true,
          temSaida: false,
          pausas,
          pausaAberta: pausas.some((p) => p.inicio && !p.fim),
        });
        return;
      }

      // Não há registro aberto
      setStatus({
        temEntrada: false,
        temSaida: false,
        pausas: [],
        pausaAberta: false,
      });
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  useEffect(() => {
    if (funcionarioId) {
      carregarStatus();
    }
  }, [funcionarioId]);

  // Verifica se o funcionário tem biometria cadastrada + carrega flag intervalo pré-assinalado da escala
  useEffect(() => {
    if (!funcionarioId) return;
    (async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('biometria_facial, escala_id')
        .eq('id', funcionarioId)
        .single();
      setTemBiometriaCadastrada(!!(data as any)?.biometria_facial);
      const escalaId = (data as any)?.escala_id;
      if (escalaId) {
        const { data: esc } = await supabase
          .from('escalas')
          .select('intervalo_pre_assinalado')
          .eq('id', escalaId)
          .single();
        setIntervaloPreAssinalado(!!(esc as any)?.intervalo_pre_assinalado);
      } else {
        setIntervaloPreAssinalado(false);
      }
    })();
  }, [funcionarioId]);

  // Carrega a configuração de geofence
  useEffect(() => {
    const carregarGeofence = async () => {
      const { data } = await supabase
        .from('configuracoes_empresa')
        .select('geofence_ativo, geofence_latitude, geofence_longitude, geofence_raio_metros')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setGeofenceConfig({
          geofence_ativo: (data as any).geofence_ativo ?? false,
          geofence_latitude: (data as any).geofence_latitude ?? null,
          geofence_longitude: (data as any).geofence_longitude ?? null,
          geofence_raio_metros: (data as any).geofence_raio_metros ?? 150,
        });
      }
    };
    carregarGeofence();
  }, []);

  /**
   * Executa de fato o registro de ponto após todas as validações.
   * Extraído para poder ser chamado tanto direto (sem biometria) quanto
   * após o callback de validação facial bem-sucedida.
   */
  const executarRegistro = async (tipo: TipoRegistro) => {
    // Validação de geofence antes de qualquer ação
    const validacao = validarGeofence(geofenceConfig, latitude, longitude);
    if (!validacao.permitido) {
      toast({
        variant: "destructive",
        title: "Registro bloqueado pela geofence",
        description: validacao.mensagem,
      });
      return;
    }

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
        case 'pausa_inicio': {
          const pausasAtuais = parsePausas((registroExistente as any)?.intervalos_pausas);
          if (pausasAtuais.some((p) => p.inicio && !p.fim)) {
            throw new Error('Já existe um intervalo em andamento. Finalize-o antes de iniciar outro.');
          }
          const novas = [...pausasAtuais, { inicio: horario, fim: null }];
          updateData.intervalos_pausas = novas;
          // Compat. legado: 1ª pausa também preenche intervalo_inicio
          if (!registroExistente?.intervalo_inicio) {
            updateData.intervalo_inicio = horario;
          }
          break;
        }
        case 'pausa_fim': {
          const pausasAtuais = parsePausas((registroExistente as any)?.intervalos_pausas);
          const idx = pausasAtuais.findIndex((p) => p.inicio && !p.fim);
          if (idx === -1) {
            throw new Error('Nenhum intervalo aberto para finalizar.');
          }
          const novas = pausasAtuais.map((p, i) => i === idx ? { ...p, fim: horario } : p);
          updateData.intervalos_pausas = novas;
          // Compat. legado: último fim alimenta intervalo_fim
          updateData.intervalo_fim = horario;
          break;
        }
        case 'saida': {
          updateData.saida = horario;
          const pausasAtuais = parsePausas((registroExistente as any)?.intervalos_pausas);
          // Não inferir intervalo automático quando: escala pré-assinalada,
          // ou já houve pausas registradas, ou intervalo_inicio já preenchido.
          if (
            !intervaloPreAssinalado &&
            pausasAtuais.length === 0 &&
            registroExistente?.entrada &&
            !registroExistente.intervalo_inicio
          ) {
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
        pausa_inicio: 'Início do Intervalo',
        pausa_fim: 'Fim do Intervalo',
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

  /**
   * Entrypoint dos botões. Se o funcionário tem biometria cadastrada,
   * abre o dialog de validação facial antes de registrar.
   */
  const registrarPonto = (tipo: TipoRegistro) => {
    if (temBiometriaCadastrada) {
      setTipoPendente(tipo);
      setBiometriaOpen(true);
    } else {
      executarRegistro(tipo);
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
  const mostrarIntervalos =
    status.temEntrada && !status.temSaida && !intervaloPreAssinalado;
  const totalPausas = calcularTotalPausas(status.pausas);

  // Status visual da geofence
  const validacao = validarGeofence(geofenceConfig, latitude, longitude);
  const geofenceAtiva = geofenceConfig?.geofence_ativo === true;

  return (
    <div className="space-y-6">
      {/* Indicador de geofence */}
      {geofenceAtiva && (
        <div
          className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
            validacao.permitido
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {validacao.permitido ? (
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <MapPinOff className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="leading-tight">
            {validacao.permitido
              ? validacao.mensagem || 'Localização verificada.'
              : validacao.mensagem}
          </span>
        </div>
      )}

      {/* Botão Principal de Entrada/Saída */}
      {proximoPrincipal && (
        <Button
          onClick={() => registrarPonto(proximoPrincipal.tipo)}
          disabled={registrando !== null || (geofenceAtiva && !validacao.permitido)}
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
            Intervalo (você pode iniciar e finalizar quantas vezes precisar)
          </p>
          <Button
            onClick={() =>
              registrarPonto(status.pausaAberta ? 'pausa_fim' : 'pausa_inicio')
            }
            disabled={registrando !== null}
            className={`w-full h-14 text-sm font-semibold ${
              status.pausaAberta
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                : 'bg-accent text-accent-foreground hover:bg-accent/90'
            }`}
          >
            {registrando === 'pausa_inicio' || registrando === 'pausa_fim' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status.pausaAberta ? (
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                <span>Finalizar Intervalo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5" />
                <span>Iniciar Intervalo</span>
              </div>
            )}
          </Button>

          {status.pausas.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Pausas do dia ({status.pausas.length})
                </span>
                <span className="font-semibold">
                  Total: {totalPausas.slice(0, 5)}
                </span>
              </div>
              <ul className="space-y-1">
                {status.pausas.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    <Coffee className="w-3 h-3 text-muted-foreground" />
                    <span>
                      #{i + 1}: {p.inicio?.slice(0, 5) ?? '--:--'} →{' '}
                      {p.fim?.slice(0, 5) ?? (
                        <span className="italic text-amber-600">em andamento</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Aviso quando o intervalo é pré-assinalado */}
      {status.temEntrada && !status.temSaida && intervaloPreAssinalado && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary flex items-start gap-2">
          <Coffee className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Sua escala usa <b>intervalo pré-assinalado</b>. O intervalo já está
            previsto na escala e será descontado automaticamente. Não é
            necessário registrar início/fim do intervalo.
          </span>
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

      {/* Validação biométrica */}
      <ValidacaoBiometricaDialog
        open={biometriaOpen}
        onOpenChange={setBiometriaOpen}
        funcionarioId={funcionarioId}
        funcionarioNome={funcionarioNome}
        contexto="registro_ponto"
        onValidado={() => {
          if (tipoPendente) {
            const t = tipoPendente;
            setTipoPendente(null);
            executarRegistro(t);
          }
        }}
        onCancelado={() => setTipoPendente(null)}
      />
    </div>
  );
}
