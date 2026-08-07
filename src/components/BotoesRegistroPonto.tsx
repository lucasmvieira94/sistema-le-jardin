import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, PauseCircle, PlayCircle, Loader2, Check, MapPinOff, Coffee, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatInTimeZone } from 'date-fns-tz';
import { validarGeofence, type GeofenceConfig } from '@/utils/geofence';
import ValidacaoBiometricaDialog from '@/components/biometria/ValidacaoBiometricaDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
  const [alertaEhPausa, setAlertaEhPausa] = useState(false);
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceConfig | null>(null);
  const [biometriaOpen, setBiometriaOpen] = useState(false);
  const [tipoPendente, setTipoPendente] = useState<TipoRegistro | null>(null);
  const [temBiometriaCadastrada, setTemBiometriaCadastrada] = useState<boolean | null>(null);
  const [intervaloPreAssinalado, setIntervaloPreAssinalado] = useState<boolean>(false);
  const [intervaloMinutos, setIntervaloMinutos] = useState<number>(60);
  const [tickAgora, setTickAgora] = useState<Date>(new Date());
  const avisoFimRef = React.useRef(false);
  const [confirmSaidaAberto, setConfirmSaidaAberto] = useState(false);
  const [horarioEntradaEscala, setHorarioEntradaEscala] = useState<string | null>(null);
  /** Se o dia de hoje está previsto na escala do funcionário (null = ainda carregando/sem escala). */
  const [diaPrevistoEscala, setDiaPrevistoEscala] = useState<boolean | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [justificativaAberta, setJustificativaAberta] = useState(false);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [justificativaInfo, setJustificativaInfo] = useState<{
    registroId: string | null;
    data: string;
    minutosAtraso: number;
    horarioPrevisto: string;
    horarioRegistrado: string;
  } | null>(null);
  const [salvandoJustificativa, setSalvandoJustificativa] = useState(false);
  const { logEvent } = useAuditLog();

  // Função para fechar alerta e voltar à tela inicial
  const handleConfirmarAlerta = () => {
    setAlertaAberto(false);
    // Em pausas (início/fim) o funcionário permanece na tela para poder
    // iniciar/finalizar quantos intervalos forem necessários.
    if (!alertaEhPausa) {
      navigate('/funcionario-access');
    }
  };

  const enviarJustificativaAtraso = async () => {
    if (!justificativaInfo) return;
    if (justificativaTexto.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Justificativa muito curta', description: 'Descreva o motivo do atraso.' });
      return;
    }
    setSalvandoJustificativa(true);
    try {
      const { error } = await supabase.from('justificativas_atraso').insert({
        tenant_id: tenantId,
        funcionario_id: funcionarioId,
        registro_ponto_id: justificativaInfo.registroId,
        data: justificativaInfo.data,
        horario_previsto: justificativaInfo.horarioPrevisto,
        horario_registrado: justificativaInfo.horarioRegistrado,
        minutos_atraso: justificativaInfo.minutosAtraso,
        justificativa: justificativaTexto.trim(),
        status: 'pendente',
      });
      if (error) throw error;
      toast({ title: 'Justificativa enviada', description: 'O gestor será notificado para análise.' });
      setJustificativaAberta(false);
      setJustificativaInfo(null);
      setJustificativaTexto('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSalvandoJustificativa(false);
    }
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

  /** Converte "HH:mm:ss" em segundos desde a meia-noite. */
  const horaParaSegundos = (hora?: string | null): number | null => {
    if (!hora) return null;
    const [h, m, s] = hora.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 3600 + m * 60 + (s || 0);
  };

  /** Total de segundos de pausas já finalizadas no dia. */
  const segundosPausasFinalizadas = (pausas: Pausa[]): number => {
    let total = 0;
    for (const p of pausas) {
      const ini = horaParaSegundos(p.inicio);
      const fim = horaParaSegundos(p.fim);
      if (ini === null || fim === null) continue;
      let diff = fim - ini;
      if (diff < 0) diff += 24 * 3600;
      total += diff;
    }
    return total;
  };

  /** Segundos decorridos da pausa em andamento (fuso de São Paulo). */
  const segundosPausaEmAndamento = (pausas: Pausa[], agora: Date): number => {
    const aberta = pausas.find((p) => p.inicio && !p.fim);
    const ini = horaParaSegundos(aberta?.inicio);
    if (ini === null) return 0;
    const agoraSeg =
      horaParaSegundos(formatInTimeZone(agora, 'America/Sao_Paulo', 'HH:mm:ss')) ?? 0;
    let diff = agoraSeg - ini;
    if (diff < 0) diff += 24 * 3600;
    return diff;
  };

  const formatarDuracao = (segundos: number): string => {
    const abs = Math.abs(Math.floor(segundos));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${String(h).padStart(2, '0')}:${base}` : base;
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

  // Verifica se o dia de hoje está previsto na escala do funcionário
  useEffect(() => {
    if (!funcionarioId) return;
    (async () => {
      const hoje = formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      const { data, error } = await supabase.rpc('preencher_horarios_por_escala', {
        p_funcionario_id: funcionarioId,
        p_data_inicio: hoje,
        p_data_fim: hoje,
      });
      if (error || !data || (data as any[]).length === 0) {
        // Sem escala definida: não bloqueia o registro
        setDiaPrevistoEscala(null);
        return;
      }
      setDiaPrevistoEscala(!!(data as any[])[0].deve_trabalhar);
    })();
  }, [funcionarioId]);

  // Tick de 1s enquanto houver intervalo em andamento (contador regressivo)
  useEffect(() => {
    if (!status.pausaAberta) return;
    setTickAgora(new Date());
    const timer = setInterval(() => setTickAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, [status.pausaAberta]);

  // Notifica o funcionário quando o tempo de intervalo se esgota
  useEffect(() => {
    if (!status.pausaAberta) {
      avisoFimRef.current = false;
      return;
    }
    const consumidos =
      segundosPausasFinalizadas(status.pausas) +
      segundosPausaEmAndamento(status.pausas, tickAgora);
    const restante = intervaloMinutos * 60 - consumidos;
    if (restante <= 0 && !avisoFimRef.current) {
      avisoFimRef.current = true;
      toast({
        variant: 'destructive',
        title: 'Intervalo encerrado',
        description:
          'O tempo de intervalo acabou. Finalize o intervalo — os minutos excedentes serão descontados.',
        duration: 10000,
      });
      try {
        navigator.vibrate?.([300, 150, 300]);
      } catch { /* ignora */ }
    }
  }, [tickAgora, status.pausaAberta, status.pausas, intervaloMinutos]);

  // Verifica se o funcionário tem biometria cadastrada + carrega flag intervalo pré-assinalado da escala
  useEffect(() => {
    if (!funcionarioId) return;
    (async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('biometria_facial, escala_id, tenant_id, exigir_biometria')
        .eq('id', funcionarioId)
        .single();
      setTemBiometriaCadastrada(!!(data as any)?.biometria_facial && ((data as any)?.exigir_biometria ?? true));
      const escalaId = (data as any)?.escala_id;
      setTenantId((data as any)?.tenant_id ?? null);
      // Padrão da empresa usado quando a escala não define duração própria
      const { data: cfg } = await supabase
        .from('configuracoes_empresa')
        .select('intervalo_minimo_minutos')
        .maybeSingle();
      const padraoEmpresa = Number((cfg as any)?.intervalo_minimo_minutos) || 60;
      if (escalaId) {
        const { data: esc } = await supabase
          .from('escalas')
          .select('intervalo_pre_assinalado, entrada, intervalo_minutos')
          .eq('id', escalaId)
          .single();
        setIntervaloPreAssinalado(!!(esc as any)?.intervalo_pre_assinalado);
        const minutosEscala = Number((esc as any)?.intervalo_minutos);
        setIntervaloMinutos(Number.isFinite(minutosEscala) && minutosEscala > 0 ? minutosEscala : padraoEmpresa);
        setHorarioEntradaEscala((esc as any)?.entrada ?? null);
      } else {
        setIntervaloPreAssinalado(false);
        setIntervaloMinutos(padraoEmpresa);
        setHorarioEntradaEscala(null);
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
    // Escalas com intervalo pré-assinalado não permitem registro manual de intervalo
    if (intervaloPreAssinalado && (tipo === 'pausa_inicio' || tipo === 'pausa_fim')) {
      toast({
        variant: 'destructive',
        title: 'Intervalo pré-assinalado',
        description:
          'Sua escala já possui o intervalo pré-assinalado e ele é descontado automaticamente. Por isso não há registro manual de início/fim de intervalo.',
      });
      return;
    }
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
      setAlertaEhPausa(tipo === 'pausa_inicio' || tipo === 'pausa_fim');
      setAlertaAberto(true);

      await carregarStatus();
      onRegistroRealizado();

      // Detectar atraso > 15min ao registrar ENTRADA e solicitar justificativa
      if (tipo === 'entrada' && horarioEntradaEscala) {
        const [ph, pm] = horarioEntradaEscala.split(':').map(Number);
        const [rh, rm] = horario.split(':').map(Number);
        const atrasoMin = (rh * 60 + rm) - (ph * 60 + pm);
        if (atrasoMin > 15) {
          // Buscar id do registro recém-gravado
          const { data: reg } = await supabase
            .from('registros_ponto')
            .select('id')
            .eq('funcionario_id', funcionarioId)
            .eq('data', dataReferencia)
            .maybeSingle();
          setJustificativaInfo({
            registroId: (reg as any)?.id ?? null,
            data: dataReferencia,
            minutosAtraso: atrasoMin,
            horarioPrevisto: horarioEntradaEscala,
            horarioRegistrado: horario,
          });
          setJustificativaTexto('');
          setTimeout(() => setJustificativaAberta(true), 300);
        }
      }
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
  /** Jornada do dia já encerrada (entrada e saída registradas). */
  const jornadaConcluida = status.temSaida;
  /** Dia não previsto na escala e sem jornada iniciada. */
  const diaNaoPrevisto = diaPrevistoEscala === false && !status.temEntrada;

  const registrarPonto = (tipo: TipoRegistro) => {
    // Bloqueios de jornada
    if (jornadaConcluida) {
      toast({
        variant: 'destructive',
        title: 'JORNADA DE TRABALHO CONCLUÍDA',
        description: 'Todos os registros do dia já foram efetuados.',
      });
      return;
    }
    if (tipo === 'entrada' && diaNaoPrevisto) {
      toast({
        variant: 'destructive',
        title: `${funcionarioNome.toUpperCase()}, ATENÇÃO`,
        description:
          'DIA DE TRABALHO NÃO PREVISTO NA ESCALA DE TRABALHO. ENTRE EM CONTATO COM A ADMINISTRAÇÃO.',
        duration: 12000,
      });
      return;
    }
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
  const segundosConsumidos =
    segundosPausasFinalizadas(status.pausas) +
    (status.pausaAberta ? segundosPausaEmAndamento(status.pausas, tickAgora) : 0);
  const segundosRestantes = intervaloMinutos * 60 - segundosConsumidos;
  const excedido = segundosRestantes < 0;

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

      {/* Dia não previsto na escala — registro bloqueado */}
      {diaNaoPrevisto && (
        <div className="text-center p-6 bg-destructive/10 rounded-xl border-2 border-destructive/30">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
          <p className="text-base font-bold text-destructive uppercase leading-snug">
            {funcionarioNome}, atenção, dia de trabalho não previsto na escala de
            trabalho. Entre em contato com a administração.
          </p>
        </div>
      )}

      {/* Botão Principal de ENTRADA (destaque) */}
      {proximoPrincipal && proximoPrincipal.tipo === 'entrada' && !diaNaoPrevisto && (
        <Button
          onClick={() => registrarPonto('entrada')}
          disabled={registrando !== null || (geofenceAtiva && !validacao.permitido)}
          className="w-full h-20 text-xl font-bold shadow-lg bg-primary hover:bg-primary/90"
          size="lg"
        >
          {registrando === 'entrada' ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>Registrando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <LogIn className="w-7 h-7" />
              <span>REGISTRAR ENTRADA</span>
            </div>
          )}
        </Button>
      )}

      {/* Jornada concluída — registro bloqueado */}
      {jornadaConcluida && (
        <div className="text-center p-6 bg-primary/10 rounded-xl border-2 border-primary/30">
          <Check className="w-12 h-12 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-primary uppercase">
            Jornada de trabalho concluída
          </p>
          <p className="text-sm text-muted-foreground">
            Todos os registros do dia já foram efetuados. Novos registros estão
            bloqueados.
          </p>
        </div>
      )}

      {/* Botões de Intervalo (só aparecem após entrada e antes da saída) */}
      {mostrarIntervalos && (
        <div
          className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${
            status.pausaAberta
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
              : 'border-dashed border-muted-foreground/30 bg-muted/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <Coffee
              className={`w-5 h-5 ${
                status.pausaAberta ? 'text-amber-600' : 'text-muted-foreground'
              }`}
            />
            <p className="text-sm font-semibold">
              {status.pausaAberta
                ? 'Intervalo em andamento'
                : 'Intervalo (opcional)'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {status.pausaAberta
              ? 'Volte aqui ao retornar e toque em "Finalizar Intervalo".'
              : 'Você pode iniciar e finalizar o intervalo quantas vezes precisar.'}
          </p>

          {/* Contador regressivo do intervalo */}
          <div
            className={`rounded-xl border p-3 text-center ${
              excedido
                ? 'border-destructive/40 bg-destructive/10'
                : 'border-primary/20 bg-primary/5'
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {excedido ? 'Tempo excedido' : 'Tempo restante de intervalo'}
            </p>
            <p
              className={`font-mono text-3xl font-bold tracking-tight ${
                excedido ? 'text-destructive' : 'text-primary'
              }`}
            >
              {excedido ? '-' : ''}
              {formatarDuracao(segundosRestantes)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Intervalo previsto na escala: {intervaloMinutos} min · Utilizado:{' '}
              {formatarDuracao(segundosConsumidos)}
            </p>
            {excedido && (
              <p className="text-[11px] font-semibold text-destructive mt-1">
                Os minutos excedentes serão descontados das horas trabalhadas/extras.
              </p>
            )}
          </div>
          <Button
            onClick={() =>
              registrarPonto(status.pausaAberta ? 'pausa_fim' : 'pausa_inicio')
            }
            disabled={registrando !== null}
            className={`w-full h-16 text-base font-bold ${
              status.pausaAberta
                ? 'bg-amber-500 text-white hover:bg-amber-500/90'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {registrando === 'pausa_inicio' || registrando === 'pausa_fim' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : status.pausaAberta ? (
              <div className="flex items-center gap-2">
                <PlayCircle className="w-6 h-6" />
                <span>FINALIZAR INTERVALO</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <PauseCircle className="w-6 h-6" />
                <span>INICIAR INTERVALO</span>
              </div>
            )}
          </Button>

          {status.pausas.length > 0 && (
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
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

      {/* Botão de SAÍDA — separado visualmente para evitar toque acidental */}
      {proximoPrincipal && proximoPrincipal.tipo === 'saida' && (
        <div className="pt-2 border-t border-dashed border-muted-foreground/30">
          {status.pausaAberta && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Existe um intervalo aberto. Finalize-o antes de encerrar a
                jornada.
              </span>
            </div>
          )}
          <Button
            onClick={() => setConfirmSaidaAberto(true)}
            disabled={
              registrando !== null ||
              status.pausaAberta ||
              (geofenceAtiva && !validacao.permitido)
            }
            variant="outline"
            className="w-full h-16 text-base font-bold border-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            {registrando === 'saida' ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Registrando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <LogOut className="w-6 h-6" />
                <span>ENCERRAR JORNADA (SAÍDA)</span>
              </div>
            )}
          </Button>
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

      {/* Confirmação antes de registrar SAÍDA */}
      <AlertDialog open={confirmSaidaAberto} onOpenChange={setConfirmSaidaAberto}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
              <LogOut className="w-8 h-8 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Encerrar a jornada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, sua <b>saída</b> será registrada e o dia será
              fechado. Use esta opção apenas no <b>final do expediente</b> —
              não para iniciar o intervalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              className="w-full bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setConfirmSaidaAberto(false);
                registrarPonto('saida');
              }}
            >
              Sim, encerrar jornada
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">
              Cancelar
            </AlertDialogCancel>
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

      {/* Modal: justificativa de atraso (>15min) */}
      <Dialog
        open={justificativaAberta}
        onOpenChange={(o) => {
          // Não permite fechar sem enviar
          if (!salvandoJustificativa) setJustificativaAberta(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" /> Justificativa de atraso
            </DialogTitle>
            <DialogDescription>
              {justificativaInfo && (
                <>
                  Você registrou entrada às{' '}
                  <b>{justificativaInfo.horarioRegistrado.slice(0, 5)}</b>, com{' '}
                  <b>{justificativaInfo.minutosAtraso} min</b> de atraso em
                  relação ao horário previsto{' '}
                  (<b>{justificativaInfo.horarioPrevisto.slice(0, 5)}</b>).
                  Descreva brevemente o motivo — o gestor irá analisar.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={justificativaTexto}
            onChange={(e) => setJustificativaTexto(e.target.value)}
            placeholder="Ex.: Problema com transporte, consulta médica, etc."
            rows={4}
            maxLength={500}
            disabled={salvandoJustificativa}
          />
          <DialogFooter>
            <Button
              onClick={enviarJustificativaAtraso}
              disabled={salvandoJustificativa || justificativaTexto.trim().length < 5}
              className="w-full"
            >
              {salvandoJustificativa ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                'Enviar justificativa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
