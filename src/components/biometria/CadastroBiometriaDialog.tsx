import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Check, Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { extrairDescriptor, mediaDescriptors } from '@/lib/faceApi';
import CameraFacial from './CameraFacial';

interface CadastroBiometriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
  onCadastrado?: () => void;
}

const TOTAL_AMOSTRAS = 3;

/**
 * Dialog para o ADMIN cadastrar a biometria facial de um funcionário.
 * Coleta 3 amostras (ângulos ligeiramente diferentes), calcula a média
 * e salva como `biometria_facial` no banco.
 */
export default function CadastroBiometriaDialog({
  open,
  onOpenChange,
  funcionarioId,
  funcionarioNome,
  onCadastrado,
}: CadastroBiometriaDialogProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [amostras, setAmostras] = useState<number[][]>([]);
  const [capturando, setCapturando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const resetar = () => {
    setAmostras([]);
  };

  const capturarAmostra = async () => {
    if (!video) return;
    setCapturando(true);
    try {
      const descriptor = await extrairDescriptor(video);
      if (!descriptor) {
        toast({
          variant: 'destructive',
          title: 'Rosto não detectado',
          description: 'Posicione o rosto centralizado, com boa iluminação, e tente novamente.',
        });
        return;
      }
      setAmostras((prev) => [...prev, descriptor]);
      toast({ title: `Amostra ${amostras.length + 1}/${TOTAL_AMOSTRAS} capturada` });
    } finally {
      setCapturando(false);
    }
  };

  const salvar = async () => {
    if (amostras.length < TOTAL_AMOSTRAS) return;
    setSalvando(true);
    try {
      const media = mediaDescriptors(amostras);
      const { error } = await supabase
        .from('funcionarios')
        .update({
          biometria_facial: media as any,
          biometria_cadastrada_em: new Date().toISOString(),
        })
        .eq('id', funcionarioId);

      if (error) throw error;

      toast({
        title: 'Biometria cadastrada!',
        description: `Rosto de ${funcionarioNome} salvo com sucesso.`,
      });
      onCadastrado?.();
      onOpenChange(false);
      resetar();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar biometria',
        description: err.message,
      });
    } finally {
      setSalvando(false);
    }
  };

  const progresso = (amostras.length / TOTAL_AMOSTRAS) * 100;
  const completo = amostras.length >= TOTAL_AMOSTRAS;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Biometria Facial</DialogTitle>
          <DialogDescription>
            {funcionarioNome} — capture {TOTAL_AMOSTRAS} amostras do rosto em ângulos levemente diferentes.
          </DialogDescription>
        </DialogHeader>

        <CameraFacial
          onReady={setVideo}
          status={completo ? 'success' : capturando ? 'capturing' : 'idle'}
          mensagem={completo
            ? 'Captura completa! Clique em "Salvar Biometria".'
            : `Amostra ${amostras.length + 1} de ${TOTAL_AMOSTRAS}`}
        />

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {amostras.length > 0 && (
            <Button variant="outline" onClick={resetar} disabled={salvando}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Recomeçar
            </Button>
          )}
          {!completo ? (
            <Button onClick={capturarAmostra} disabled={!video || capturando} className="flex-1">
              {capturando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Capturar amostra
            </Button>
          ) : (
            <Button onClick={salvar} disabled={salvando} className="flex-1">
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Salvar Biometria
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}