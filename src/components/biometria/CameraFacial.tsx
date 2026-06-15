import { useEffect, useRef, useState } from 'react';
import { Loader2, Video, VideoOff } from 'lucide-react';
import { carregarModelos } from '@/lib/faceApi';

interface CameraFacialProps {
  /** Callback chamado quando o vídeo está pronto e os modelos carregados. */
  onReady: (video: HTMLVideoElement) => void;
  /** Mostrar overlay de "rosto detectado" (opcional). */
  status?: 'idle' | 'capturing' | 'success' | 'error';
  mensagem?: string;
}

/**
 * Componente reutilizável de webcam para captura facial.
 * - Solicita permissão de câmera.
 * - Carrega os modelos face-api em paralelo.
 * - Quando ambos prontos, dispara onReady(videoElement).
 */
export default function CameraFacial({ onReady, status = 'idle', mensagem }: CameraFacialProps) {
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
    capturing: 'border-primary animate-pulse',
    success: 'border-green-500',
    error: 'border-destructive',
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
      {mensagem && (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Video className="h-4 w-4" />
          {mensagem}
        </p>
      )}
    </div>
  );
}