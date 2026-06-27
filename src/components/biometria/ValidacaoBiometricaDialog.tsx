import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BIOMETRIA_THRESHOLD, distanciaEuclidiana, extrairDescriptor } from '@/lib/faceApi';
import CameraFacial from './CameraFacial';

interface ValidacaoBiometricaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
  contexto: 'registro_ponto' | 'login_portal' | 'prontuario' | 'intercorrencia';
  /** Disparado quando a validação foi bem-sucedida. O componente fecha sozinho. */
  onValidado: () => void;
  /** Disparado quando o usuário cancela ou esgota tentativas. */
  onCancelado?: () => void;
}

const MAX_TENTATIVAS_AUTO = 5;

/**
 * Dialog que valida a biometria facial do funcionário.
 * - Busca o descriptor salvo.
 * - Faz captura contínua (a cada 800ms) e compara via distância Euclidiana.
 * - Registra cada tentativa em `biometria_validacoes_log` (auditoria LGPD).
 */
export default function ValidacaoBiometricaDialog({
  open,
  onOpenChange,
  funcionarioId,
  funcionarioNome,
  contexto,
  onValidado,
  onCancelado,
}: ValidacaoBiometricaDialogProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [descriptorSalvo, setDescriptorSalvo] = useState<number[] | null>(null);
  const [status, setStatus] = useState<'carregando' | 'analisando' | 'sucesso' | 'falha' | 'sem_cadastro'>('carregando');
  const [tentativas, setTentativas] = useState(0);
  const [ultimaDistancia, setUltimaDistancia] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Carrega o descriptor salvo do funcionário
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('biometria_facial')
        .eq('id', funcionarioId)
        .single();

      if (error || !data?.biometria_facial) {
        setStatus('sem_cadastro');
        return;
      }
      setDescriptorSalvo(data.biometria_facial as unknown as number[]);
      setStatus('analisando');
    })();
  }, [open, funcionarioId]);

  const registrarLog = async (sucesso: boolean, distancia: number | null) => {
    try {
      await supabase.from('biometria_validacoes_log').insert({
        funcionario_id: funcionarioId,
        contexto,
        sucesso,
        distancia,
        threshold: BIOMETRIA_THRESHOLD,
        user_agent: navigator.userAgent.slice(0, 500),
      });
    } catch (e) {
      console.warn('[biometria] log falhou', e);
    }
  };

  // Loop de captura
  useEffect(() => {
    if (!open || !video || !descriptorSalvo || status !== 'analisando') return;

    const tick = async () => {
      const descriptor = await extrairDescriptor(video);
      if (!descriptor) return; // nenhum rosto detectado este frame

      const dist = distanciaEuclidiana(descriptor, descriptorSalvo);
      setUltimaDistancia(dist);

      if (dist < BIOMETRIA_THRESHOLD) {
        setStatus('sucesso');
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        await registrarLog(true, dist);
        setTimeout(() => {
          onValidado();
          onOpenChange(false);
        }, 700);
      } else {
        setTentativas((t) => {
          const novo = t + 1;
          if (novo >= MAX_TENTATIVAS_AUTO) {
            setStatus('falha');
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            registrarLog(false, dist);
          }
          return novo;
        });
      }
    };

    intervalRef.current = window.setInterval(tick, 800);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, video, descriptorSalvo, status]);

  const tentarNovamente = () => {
    setTentativas(0);
    setUltimaDistancia(null);
    setStatus('analisando');
  };

  const cancelar = () => {
    onOpenChange(false);
    onCancelado?.();
  };

  const mensagemCamera =
    status === 'sucesso'
      ? '✓ Identidade confirmada!'
      : status === 'falha'
      ? 'Não foi possível identificar. Tente novamente.'
      : status === 'sem_cadastro'
      ? 'Funcionário sem biometria cadastrada.'
      : `Posicione o rosto na câmera... (${tentativas}/${MAX_TENTATIVAS_AUTO})`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancelar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Validação Facial</DialogTitle>
          <DialogDescription>
            {funcionarioNome} — confirme sua identidade pela câmera.
          </DialogDescription>
        </DialogHeader>

        {status === 'sem_cadastro' ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
            <p className="text-sm">
              Este funcionário ainda não possui biometria cadastrada. Procure o administrador para realizar o cadastro.
            </p>
          </div>
        ) : (
          <>
            <CameraFacial
              onReady={setVideo}
              status={
                status === 'sucesso' ? 'success' :
                status === 'falha' ? 'error' :
                status === 'analisando' ? 'capturing' : 'idle'
              }
              mensagem={mensagemCamera}
              progresso={
                status === 'sucesso'
                  ? 100
                  : status === 'analisando'
                  ? (tentativas / MAX_TENTATIVAS_AUTO) * 100
                  : status === 'falha'
                  ? 100
                  : 0
              }
            />
            {ultimaDistancia !== null && status === 'analisando' && (
              <p className="text-center text-xs text-muted-foreground">
                Similaridade: {((1 - ultimaDistancia) * 100).toFixed(1)}%
              </p>
            )}
          </>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {status === 'falha' && (
            <Button onClick={tentarNovamente} className="flex-1">
              <Loader2 className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          )}
          {status === 'sucesso' && (
            <Button disabled className="flex-1 bg-green-600">
              <Check className="mr-2 h-4 w-4" />
              Validado!
            </Button>
          )}
          <Button variant="outline" onClick={cancelar}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}