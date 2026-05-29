import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Intervalo de verificação periódica da versão (60 segundos).
 * Também verifica ao voltar para a aba e ao reconectar.
 */
const CHECK_INTERVAL_MS = 60 * 1000;

/** Versão "assada" no bundle em tempo de build (injetada via Vite `define`). */
const CURRENT_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export interface VersionCheckState {
  /** Existe nova versão publicada disponível. */
  updateAvailable: boolean;
  /** Versão remota detectada (quando há atualização). */
  remoteVersion: string | null;
  /** Versão atualmente em execução. */
  currentVersion: string;
  /** Aplica a atualização: limpa caches, desregistra SW e recarrega. */
  applyUpdate: () => Promise<void>;
}

/**
 * Hook que monitora a versão publicada do app.
 *
 * Estratégia:
 *  1. No build, `vite.config.ts` grava `public/version.json` com um timestamp único
 *     e injeta a mesma string em `__APP_VERSION__`.
 *  2. O hook busca `/version.json` periodicamente (com cache busting) e compara com
 *     a versão local. Quando difere, sinaliza `updateAvailable = true`.
 *  3. `applyUpdate()` limpa todos os caches do navegador, desregistra Service Workers
 *     antigos e recarrega a página, garantindo que o usuário receba a build mais recente
 *     sem precisar limpar nada manualmente.
 *  4. Também escuta o ciclo padrão de atualização do PWA (vite-plugin-pwa) e dispara
 *     a aplicação imediata quando um novo SW termina de instalar.
 */
export function useVersionCheck(): VersionCheckState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const fetchRemoteVersion = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { version?: string };
      return typeof data?.version === 'string' ? data.version : null;
    } catch {
      return null;
    }
  }, []);

  const checkVersion = useCallback(async () => {
    const remote = await fetchRemoteVersion();
    if (!remote) return;
    if (remote !== CURRENT_VERSION && CURRENT_VERSION !== 'dev') {
      setRemoteVersion(remote);
      setUpdateAvailable(true);
    }
  }, [fetchRemoteVersion]);

  const applyUpdate = useCallback(async () => {
    try {
      // 1) Limpa todos os caches do navegador (Workbox/PWA, runtime, etc.)
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // 2) Desregistra Service Workers antigos para forçar fetch direto do servidor
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            try {
              await reg.unregister();
            } catch {
              /* ignore */
            }
          })
        );
      }
    } catch {
      // mesmo se falhar a limpeza, recarregamos abaixo
    }
    // 3) Hard reload — busca novamente o HTML e novos assets
    window.location.reload();
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Verificação inicial logo após montar
    checkVersion();
    intervalId = setInterval(checkVersion, CHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    const handleOnline = () => checkVersion();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    // Integração com vite-plugin-pwa: dispara update imediato quando o SW está pronto.
    (async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        updateSWRef.current = registerSW({
          immediate: true,
          onNeedRefresh() {
            setUpdateAvailable(true);
          },
          onRegisteredSW(_url, registration) {
            if (!registration) return;
            setInterval(() => registration.update().catch(() => {}), CHECK_INTERVAL_MS);
          },
        });
      } catch {
        // SW indisponível (preview/iframe) — verificação por version.json continua valendo
      }
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkVersion]);

  return { updateAvailable, remoteVersion, currentVersion: CURRENT_VERSION, applyUpdate };
}
