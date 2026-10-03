/**
 * Captura do rosto para assinar um documento.
 * O aparelho só extrai a "assinatura numérica" do rosto; quem compara com o
 * cadastro e decide é o servidor (não dá para burlar alterando o navegador).
 */
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { extrairDescriptor, mediaDescriptors } from '@/lib/faceApi';
import CameraFacial from './CameraFacial';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  /** Envia o rosto ao servidor; lançar erro mantém o diálogo aberto para nova tentativa. */
  onCapturado: (descriptor: number[]) => Promise<void>;
}

const FRAMES = 2;

export default function CapturaAssinaturaDialog({ open, onOpenChange, titulo, onCapturado }: Props) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [estado, setEstado] = useState<'procurando' | 'enviando' | 'erro'>('procurando');
  const [erro, setErro] = useState<string | null>(null);
  const frames = useRef<number[][]>([]);
  const ocupado = useRef(false);

  useEffect(() => {
    if (!open) { setVideo(null); setEstado('procurando'); setErro(null); frames.current = []; }
  }, [open]);

  useEffect(() => {
    if (!open || !video || estado !== 'procurando') return;
    const timer = window.setInterval(async () => {
      if (ocupado.current) return;
      ocupado.current = true;
      try {
        const d = await extrairDescriptor(video);
        if (!d) return;
        frames.current.push(d);
        if (frames.current.length >= FRAMES) {
          window.clearInterval(timer);
          setEstado('enviando');
          try {
            await onCapturado(mediaDescriptors(frames.current));
            onOpenChange(false);
          } catch (e) {
            setErro((e as Error).message || 'Rosto não reconhecido.');
            setEstado('erro');
          }
        }
      } finally {
        ocupado.current = false;
      }
    }, 700);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, video, estado]);

  const tentar = () => { frames.current = []; setErro(null); setEstado('procurando'); };

  return (
    <Dialog open={open} onOpenChange={(o) => estado !== 'enviando' && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar com seu rosto</DialogTitle>
          <DialogDescription>{titulo}</DialogDescription>
        </DialogHeader>
        <CameraFacial
          onReady={setVideo}
          status={estado === 'erro' ? 'error' : estado === 'enviando' ? 'success' : 'capturing'}
          mensagem={estado === 'enviando' ? 'Conferindo seu rosto...' : estado === 'erro' ? undefined : 'Posicione o rosto dentro da moldura'}
        />
        {erro && <p className="text-sm text-destructive text-center">{erro}</p>}
        <DialogFooter>
          {estado === 'erro' ? (
            <Button className="w-full" onClick={tentar}><RotateCcw className="w-4 h-4 mr-1" /> Tentar de novo</Button>
          ) : estado === 'enviando' ? (
            <Button className="w-full" disabled><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Conferindo</Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
