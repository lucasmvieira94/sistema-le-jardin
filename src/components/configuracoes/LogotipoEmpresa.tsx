import { useState, useRef } from 'react';
import { Upload, Image, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface LogotipoEmpresaProps {
  logoUrl?: string;
  onLogoUpdate: (url: string) => void;
}

export function LogotipoEmpresa({ logoUrl, onLogoUpdate }: LogotipoEmpresaProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use JPG, PNG, SVG ou WebP.');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      onLogoUpdate(data.publicUrl);
      toast.success('Logo enviado com sucesso!');
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removerLogo = async () => {
    if (!logoUrl) return;

    setRemoving(true);
    try {
      // Extrair nome do arquivo da URL
      const fileName = logoUrl.split('/').pop();
      if (fileName) {
        const { error } = await supabase.storage
          .from('company-logos')
          .remove([fileName]);

        if (error) throw error;
      }

      onLogoUpdate('');
      toast.success('Logo removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Logotipo da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt="Logo da empresa"
                className="max-h-32 max-w-full object-contain border rounded-lg"
              />
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Alterar Logo
              </Button>
              <Button
                variant="outline"
                onClick={removerLogo}
                disabled={removing}
                className="text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum logo enviado
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Enviando...' : 'Enviar Logo'}
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="text-sm text-muted-foreground">
          <p>• Formatos suportados: JPG, PNG, SVG, WebP</p>
          <p>• Tamanho máximo: 5MB</p>
          <p>• Será usado nos documentos gerados pelo sistema</p>
        </div>
      </CardContent>
    </Card>
  );
}