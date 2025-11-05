import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, X, Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { permission, requestPermission, isSupported } = useNotifications();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar prompt após 30 segundos se ainda não foi instalado
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
      
      // Solicitar permissão para notificações após instalação
      if (isSupported && permission !== 'granted') {
        setTimeout(() => {
          requestPermission();
        }, 1000);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Mostrar novamente em 24 horas
    setTimeout(() => {
      setShowPrompt(true);
    }, 24 * 60 * 60 * 1000);
  };

  const handleEnableNotifications = async () => {
    await requestPermission();
  };

  if (!showPrompt && (!isSupported || permission === 'granted')) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {deferredPrompt ? (
                <>
                  <Download className="h-5 w-5 text-primary" />
                  Instalar SenexCare
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5 text-primary" />
                  Ativar Notificações
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {deferredPrompt 
              ? 'Instale o app no seu celular para acesso rápido e offline'
              : 'Receba alertas importantes diretamente no seu celular'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Instalar Agora
            </Button>
          ) : isSupported && permission !== 'granted' && (
            <Button onClick={handleEnableNotifications} className="w-full">
              <Bell className="mr-2 h-4 w-4" />
              Ativar Notificações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
