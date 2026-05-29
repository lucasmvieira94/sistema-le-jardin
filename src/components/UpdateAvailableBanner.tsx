import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVersionCheck } from "@/hooks/useVersionCheck";

/**
 * Banner fixo no topo que aparece automaticamente quando uma nova versão
 * publicada do app é detectada. Permite ao usuário aplicar a atualização
 * com um clique (limpa caches, desregistra SW e recarrega).
 *
 * Após 10 segundos visível sem ação, aplica a atualização automaticamente
 * para garantir que usuários menos técnicos não fiquem em versões antigas.
 */
export function UpdateAvailableBanner() {
  const { updateAvailable, applyUpdate } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!updateAvailable || dismissed) return;
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          applyUpdate();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [updateAvailable, dismissed, applyUpdate]);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9999] bg-primary text-primary-foreground shadow-lg animate-in slide-in-from-top"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-sm sm:text-base">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>
            Nova versão disponível. Atualizando automaticamente em{" "}
            <strong>{countdown}s</strong>…
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyUpdate()}
          >
            Atualizar agora
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            aria-label="Adiar atualização"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
