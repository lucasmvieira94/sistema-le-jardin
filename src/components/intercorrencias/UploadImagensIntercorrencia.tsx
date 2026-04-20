import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadImagensIntercorrenciaProps {
  imagens: string[];
  onChange: (imagens: string[]) => void;
  maxImagens?: number;
  disabled?: boolean;
}

const MAX_TAMANHO_MB = 5;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function UploadImagensIntercorrencia({
  imagens,
  onChange,
  maxImagens = 5,
  disabled = false,
}: UploadImagensIntercorrenciaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImagens - imagens.length;
    if (remaining <= 0) {
      toast({
        title: 'Limite atingido',
        description: `Máximo de ${maxImagens} imagens por intercorrência.`,
        variant: 'destructive',
      });
      return;
    }

    const arquivos = Array.from(files).slice(0, remaining);
    setUploading(true);
    const novasUrls: string[] = [];

    for (const arquivo of arquivos) {
      if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
        toast({
          title: 'Formato inválido',
          description: `${arquivo.name} não é uma imagem suportada.`,
          variant: 'destructive',
        });
        continue;
      }
      if (arquivo.size > MAX_TAMANHO_MB * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: `${arquivo.name} excede ${MAX_TAMANHO_MB}MB.`,
          variant: 'destructive',
        });
        continue;
      }

      const ext = arquivo.name.split('.').pop() || 'jpg';
      const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const caminho = `intercorrencias/${nomeArquivo}`;

      const { error: uploadError } = await supabase.storage
        .from('intercorrencias-imagens')
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

      if (uploadError) {
        console.error('Erro upload:', uploadError);
        toast({
          title: 'Erro ao enviar imagem',
          description: uploadError.message,
          variant: 'destructive',
        });
        continue;
      }

      const { data: publicData } = supabase.storage
        .from('intercorrencias-imagens')
        .getPublicUrl(caminho);

      if (publicData?.publicUrl) novasUrls.push(publicData.publicUrl);
    }

    if (novasUrls.length > 0) {
      onChange([...imagens, ...novasUrls]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removerImagem = async (url: string) => {
    onChange(imagens.filter((u) => u !== url));
    // Remove do storage (best-effort)
    try {
      const partes = url.split('/intercorrencias-imagens/');
      if (partes[1]) {
        await supabase.storage.from('intercorrencias-imagens').remove([partes[1]]);
      }
    } catch (e) {
      console.warn('Falha ao remover do storage:', e);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Imagens (opcional) <span className="text-muted-foreground font-normal">— até {maxImagens}, máx. {MAX_TAMANHO_MB}MB cada</span>
      </Label>

      {imagens.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {imagens.map((url) => (
            <div key={url} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
              <img src={url} alt="Anexo da intercorrência" className="w-full h-full object-cover" loading="lazy" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removerImagem(url)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity"
                  aria-label="Remover imagem"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading || imagens.length >= maxImagens}
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
        ) : (
          <><ImagePlus className="w-4 h-4 mr-2" /> Adicionar imagens ({imagens.length}/{maxImagens})</>
        )}
      </Button>
    </div>
  );
}