import { createContext, useContext, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Indica que a tela está aberta dentro do Portal de Cuidados.
 * As telas de rotina usam isso para esconder o próprio cabeçalho/fundo
 * (o portal já mostra cabeçalho e abas) e seguir o mesmo visual.
 */
const Ctx = createContext(false);

export function PortalCuidadosEmbutido({ children }: { children: ReactNode }) {
  return <Ctx.Provider value>{children}</Ctx.Provider>;
}

export const useEmbutidoPortal = () => useContext(Ctx);

/** Título padrão de cada tarefa dentro do portal (substitui os cabeçalhos antigos). */
export function TituloTarefa({ icone: Icone, titulo, descricao, acao }: {
  icone: LucideIcon; titulo: string; descricao?: string; acao?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icone className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold sm:text-xl">{titulo}</h2>
        {descricao && <p className="truncate text-xs text-muted-foreground sm:text-sm">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
