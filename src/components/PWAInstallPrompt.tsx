import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, X, Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_prompt_dismissed_at';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dias
const INITIAL_DELAY = 60 * 1000; // 60s antes de mostrar

// Não exibir nessas rotas (telas operacionais críticas em mobile)
const HIDDEN_ROUTES = [
  '/funcionario-access',
  '/registro-ponto',
  '/administracao-medicamentos',
  '/controle-fraldas-publico',
  '/temperatura-medicamentos',
  '/intercorrencias',
  '/prontuario',
  '/',
];

export const PWAInstallPrompt = () => {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { permission, requestPermission, isSupported } = useNotifications();

  // Verifica se foi dispensado recentemente
  const wasDismissedRecently = () => {
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (!dismissedAt) return false;
      return Date.now() - Number(dismissedAt) < DISMISS_DURATION;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (wasDismissedRecently()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), INITIAL_DELAY);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Para iOS / quando não há beforeinstallprompt: só mostra prompt de notificação após delay
    const fallbackTimer = setTimeout(() => {
      if (isSupported && permission === 'default') {
        setShowPrompt(true);
      }
    }, INITIAL_DELAY);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, [isSupported, permission]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
      if (isSupported && permission !== 'granted') {
        setTimeout(() => requestPermission(), 1000);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const handleEnableNotifications = async () => {
    await requestPermission();
    setShowPrompt(false);
  };

  // Ocultar em rotas operacionais críticas
  const isHiddenRoute = HIDDEN_ROUTES.some(route =>
    route === '/' ? location.pathname === '/' : location.pathname.startsWith(route)
  );

  if (isHiddenRoute) return null;
  if (!showPrompt) return null;
  if (!deferredPrompt && (!isSupported || permission === 'granted')) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 max-w-sm sm:max-w-sm">
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
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
              aria-label="Fechar"
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
          ) : isSupported && permission !== 'granted' ? (
            <Button onClick={handleEnableNotifications} className="w-full">
              <Bell className="mr-2 h-4 w-4" />
              Ativar Notificações
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
