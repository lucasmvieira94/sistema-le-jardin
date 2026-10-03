/**
 * Autocadastro da biometria facial pelo próprio colaborador (portal por código).
 * Fluxo simples: tocar em "Começar" e seguir 3 orientações; cada captura é feita
 * automaticamente quando o rosto é detectado. O servidor confere se as capturas
 * são da mesma pessoa e só aceita se ainda não houver biometria cadastrada.
 */
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, RotateCcw, ScanFace } from 'lucide-react';
import { extrairDescriptor } from '@/lib/faceApi';
import { AMOSTRAS_AUTOCADASTRO, ORIENTACOES_CAPTURA, amostrasConsistentes } from '@/utils/biometria';
import { autocadastrarBiometria } from '@/hooks/useBiometriaFuncionario';
import CameraFacial from './CameraFacial';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
  onConcluido?: () => void;
}

type Etapa = 'instrucoes' | 'capturando' | 'salvando' | 'concluido' | 'erro';

export default function AutoCadastroBiometriaDialog({ open, onOpenChange, funcionarioId, funcionarioNome, onConcluido }: Props) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('instrucoes');
  const [amostras, setAmostras] = useState<number[][]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    if (!open) { setEtapa('instrucoes'); setAmostras([]); setErro(null); setVideo(null); }
  }, [open]);

  // Captura automática: a cada 1,2 s tenta pegar uma amostra
  useEffect(() => {
    if (etapa !== 'capturando' || !video) return;
    const timer = window.setInterval(async () => {
      if (ocupado.current) return;
      ocupado.current = true;
      try {
        const d = await extrairDescriptor(video);
        if (d) setAmostras((prev) => (prev.length < AMOSTRAS_AUTOCADASTRO ? [...prev, d] : prev));
      } finally {
        ocupado.current = false;
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [etapa, video]);

  // Ao completar, confere e envia
  useEffect(() => {
    if (etapa !== 'capturando' || amostras.length < AMOSTRAS_AUTOCADASTRO) return;
    if (!amostrasConsistentes(amostras)) {
      setErro('As fotos ficaram muito diferentes. Fique sozinho(a) em frente à câmera, com boa luz, e tente de novo.');
      setEtapa('erro');
      return;
    }
    setEtapa('salvando');
    autocadastrarBiometria(funcionarioId, amostras)
      .then(() => { setEtapa('concluido'); onConcluido?.(); })
      .catch((e) => { setErro(e.message ?? 'Não foi possível salvar.'); setEtapa('erro'); });
  }, [amostras, etapa, funcionarioId, onConcluido]);

  const recomecar = () => { setAmostras([]); setErro(null); setEtapa('capturando'); };
  const indice = Math.min(amostras.length, AMOSTRAS_AUTOCADASTRO - 1);

  return (
    <Dialog open={open} onOpenChange={(o) => etapa !== 'salvando' && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanFace className="w-5 h-5" /> Cadastrar meu rosto</DialogTitle>
          <DialogDescription>{funcionarioNome}</DialogDescription>
        </DialogHeader>

        {etapa === 'instrucoes' && (
          <div className="space-y-3 text-sm">
            <p>Seu rosto será usado para confirmar que é você quem assina seus documentos.</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Fique em um lugar bem iluminado, sozinho(a) na imagem.</li>
              <li>Tire boné, óculos escuros ou máscara.</li>
              <li>São 3 fotos automáticas — basta seguir as orientações.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Guardamos apenas uma sequência de números que representa o rosto, não a foto (LGPD).
            </p>
          </div>
        )}

        {(etapa === 'capturando' || etapa === 'salvando') && (
          <div className="space-y-3">
            <CameraFacial
              onReady={setVideo}
              status={etapa === 'salvando' ? 'success' : 'capturing'}
              progresso={(amostras.length / AMOSTRAS_AUTOCADASTRO) * 100}
              mensagem={etapa === 'salvando' ? 'Salvando...' : `Foto ${amostras.length + 1} de ${AMOSTRAS_AUTOCADASTRO}`}
            />
            {etapa === 'capturando' && (
              <p className="text-center font-semibold text-base">{ORIENTACOES_CAPTURA[indice]}</p>
            )}
          </div>
        )}

        {etapa === 'concluido' && (
          <div className="text-center space-y-2 py-4">
            <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
            <p className="font-semibold">Rosto cadastrado!</p>
            <p className="text-sm text-muted-foreground">Agora você já pode assinar seus documentos.</p>
          </div>
        )}

        {etapa === 'erro' && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          {etapa === 'instrucoes' && <Button className="w-full" onClick={() => setEtapa('capturando')}>Começar</Button>}
          {etapa === 'salvando' && <Button className="w-full" disabled><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando</Button>}
          {etapa === 'erro' && <Button className="w-full" onClick={recomecar}><RotateCcw className="w-4 h-4 mr-1" /> Tentar de novo</Button>}
          {etapa === 'concluido' && <Button className="w-full" onClick={() => onOpenChange(false)}>Concluir</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
