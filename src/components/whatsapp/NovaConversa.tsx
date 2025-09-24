import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Phone } from 'lucide-react';

interface NovaConversaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriarConversa: (numeroWhatsApp: string, nomeContato?: string) => Promise<any>;
}

export function NovaConversa({ open, onOpenChange, onCriarConversa }: NovaConversaProps) {
  const [numeroWhatsApp, setNumeroWhatsApp] = useState('');
  const [nomeContato, setNomeContato] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  const validarNumero = (numero: string) => {
    const numeroLimpo = numero.replace(/\D/g, '');
    return numeroLimpo.length >= 10;
  };

  const formatarNumero = (numero: string) => {
    let numeroLimpo = numero.replace(/\D/g, '');
    
    // Adicionar código do país se não tiver
    if (!numeroLimpo.startsWith('55')) {
      numeroLimpo = '55' + numeroLimpo;
    }
    
    return '+' + numeroLimpo;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!validarNumero(numeroWhatsApp)) {
      setErro('Número de WhatsApp deve ter pelo menos 10 dígitos');
      return;
    }

    setCriando(true);
    try {
      const numeroFormatado = formatarNumero(numeroWhatsApp);
      await onCriarConversa(numeroFormatado, nomeContato || undefined);
      
      // Limpar form e fechar modal
      setNumeroWhatsApp('');
      setNomeContato('');
      onOpenChange(false);
    } catch (error: any) {
      setErro(error.message || 'Erro ao criar conversa');
    } finally {
      setCriando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Nova Conversa WhatsApp
          </DialogTitle>
          <DialogDescription>
            Inicie uma nova conversa fornecendo o número do WhatsApp do contato
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="numero">Número do WhatsApp *</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="numero"
                type="tel"
                placeholder="11987654321"
                value={numeroWhatsApp}
                onChange={(e) => setNumeroWhatsApp(e.target.value)}
                className="pl-10"
                disabled={criando}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Digite apenas os números (código do país será adicionado automaticamente)
            </p>
          </div>

          <div>
            <Label htmlFor="nome">Nome do Contato (opcional)</Label>
            <Input
              id="nome"
              placeholder="Nome para facilitar identificação"
              value={nomeContato}
              onChange={(e) => setNomeContato(e.target.value)}
              disabled={criando}
            />
          </div>

          {erro && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={criando}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={criando || !numeroWhatsApp.trim()}
            >
              {criando ? 'Criando...' : 'Iniciar Conversa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}