import { useEffect, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';

const CHECK_INTERVAL = 60 * 1000; // Verificar a cada 60 segundos

export function useVersionCheck() {
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // Força re-fetch do index.html para detectar novos builds
      const response = await fetch(window.location.origin + '/', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return;

      // Verifica se o SW tem update pendente
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch {
      // Silenciar erros de rede
    }
  }, []);

  useEffect(() => {
    // Registra o SW com auto-update imediato
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Atualiza automaticamente sem perguntar
        updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] Pronto para uso offline');
      },
      onRegisteredSW(swUrl, registration) {
        if (registration) {
          // Checa periodicamente por atualizações
          setInterval(() => {
            registration.update();
          }, CHECK_INTERVAL);
        }
      },
    });

    updateSWRef.current = updateSW;

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
    };
  }, [checkForUpdates]);
}
