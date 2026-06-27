import { useEffect, useRef, useState } from 'react';
import { Loader2, Video, VideoOff } from 'lucide-react';
import { carregarModelos } from '@/lib/faceApi';
import { Progress } from '@/components/ui/progress';

interface CameraFacialProps {
  /** Callback chamado quando o vídeo está pronto e os modelos carregados. */
  onReady: (video: HTMLVideoElement) => void;
  /** Mostrar overlay de "rosto detectado" (opcional). */
  status?: 'idle' | 'capturing' | 'success' | 'error';
  mensagem?: string;
  /** Progresso 0-100 da análise (opcional). */
  progresso?: number;
  /** Esconder a moldura oval guia. */
  semMoldura?: boolean;
}

/**
 * Componente reutilizável de webcam para captura facial.
 * - Solicita permissão de câmera.
 * - Carrega os modelos face-api em paralelo.
 * - Quando ambos prontos, dispara onReady(videoElement).
 */
export default function CameraFacial({
  onReady,
  status = 'idle',
  mensagem,
  progresso,
  semMoldura = false,
}: CameraFacialProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelado = false;

    (async () => {
      try {
        const [, mediaStream] = await Promise.all([
          carregarModelos(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }),
        ]);

        if (cancelado) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
          setCarregando(false);
          onReady(videoRef.current);
        }
      } catch (err: any) {
        console.error('[CameraFacial]', err);
        if (err.name === 'NotAllowedError') {
          setErro('Permissão de câmera negada. Habilite nas configurações do navegador.');
        } else if (err.name === 'NotFoundError') {
          setErro('Nenhuma câmera encontrada neste dispositivo.');
        } else {
          setErro('Falha ao acessar a câmera ou carregar modelos.');
        }
        setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const borderClass = {
    idle: 'border-border',
    capturing: 'border-primary',
    success: 'border-green-500',
    error: 'border-destructive',
  }[status];

  const ovalStroke = {
    idle: 'stroke-border',
    capturing: 'stroke-primary',
    success: 'stroke-green-500',
    error: 'stroke-destructive',
  }[status];

  return (
    <div className="space-y-2">
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl border-4 bg-muted ${borderClass}`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover scale-x-[-1]"
        />
        {!carregando && !erro && !semMoldura && (
          <>
            {/* Moldura oval guia (SVG sobreposto) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 75"
              preserveAspectRatio="none"
            >
              {/* máscara escura ao redor da elipse */}
              <defs>
                <mask id="ovalMask">
                  <rect width="100" height="75" fill="white" />
                  <ellipse cx="50" cy="37" rx="22" ry="30" fill="black" />
                </mask>
              </defs>
              <rect
                width="100"
                height="75"
                fill="black"
                opacity="0.45"
                mask="url(#ovalMask)"
              />
              <ellipse
                cx="50"
                cy="37"
                rx="22"
                ry="30"
                fill="none"
                strokeWidth="0.8"
                strokeDasharray={status === 'capturing' ? '2 1.5' : '0'}
                className={`${ovalStroke} ${status === 'capturing' ? 'animate-pulse' : ''}`}
              />
            </svg>
            {/* Cantos guia */}
            <div className="pointer-events-none absolute inset-3">
              <div className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-white/80 rounded-tl" />
              <div className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-white/80 rounded-tr" />
              <div className="absolute left-0 bottom-0 h-5 w-5 border-l-2 border-b-2 border-white/80 rounded-bl" />
              <div className="absolute right-0 bottom-0 h-5 w-5 border-r-2 border-b-2 border-white/80 rounded-br" />
            </div>
          </>
        )}
        {carregando && !erro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Iniciando câmera...</p>
          </div>
        )}
        {erro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-4 text-center">
            <VideoOff className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{erro}</p>
          </div>
        )}
      </div>
      {typeof progresso === 'number' && !erro && (
        <Progress
          value={Math.min(100, Math.max(0, progresso))}
          className={`h-2 ${
            status === 'success'
              ? '[&>div]:bg-green-500'
              : status === 'error'
              ? '[&>div]:bg-destructive'
              : ''
          }`}
        />
      )}
      {mensagem && (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Video className="h-4 w-4" />
          {mensagem}
        </p>
      )}
    </div>
  );
}