import { useEffect, useCallback } from 'react';

const CHECK_INTERVAL = 60 * 1000; // Verificar a cada 60 segundos

export function useVersionCheck() {
  const checkForUpdates = useCallback(async () => {
    try {
      // Verifica se o SW tem update pendente
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
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
        // Importação dinâmica para evitar crash se o módulo não existir
        const { registerSW } = await import('virtual:pwa-register');

        registerSW({
          immediate: true,
          onNeedRefresh() {
            // Recarrega automaticamente
            window.location.reload();
          },
          onOfflineReady() {
            console.log('[PWA] Pronto para uso offline');
          },
          onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
            if (registration) {
              intervalId = setInterval(() => {
                registration.update();
              }, CHECK_INTERVAL);
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
