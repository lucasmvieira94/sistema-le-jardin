import { useEffect, useCallback } from 'react';

const CHECK_INTERVAL = 30 * 1000; // Verificar a cada 30 segundos

export function useVersionCheck() {
  const checkForUpdates = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
          // Se há um SW esperando, forçar ativação
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch {
      // Silenciar erros de rede
    }
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const setupSW = async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');

        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            // Recarrega automaticamente quando nova versão disponível
            window.location.reload();
          },
          onOfflineReady() {
            console.log('[PWA] Pronto para uso offline');
          },
          onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
            if (registration) {
              // Verifica atualizações periodicamente
              intervalId = setInterval(() => {
                registration.update();
              }, CHECK_INTERVAL);

              // Listener para quando novo SW está pronto
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                      window.location.reload();
                    }
                  });
                }
              });
            }
          },
        });
      } catch (err) {
        console.warn('[PWA] Service Worker não disponível:', err);
      }
    };

    setupSW();

    // Verifica ao voltar para a aba
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    // Verifica ao reconectar à internet
    const handleOnline = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkForUpdates]);
}
