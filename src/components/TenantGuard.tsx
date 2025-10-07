import { ReactNode } from 'react';
import { TenantSelector } from './TenantSelector';
import { useTenantContext } from '@/contexts/TenantContext';
import { Loader2 } from 'lucide-react';

interface TenantGuardProps {
  children: ReactNode;
}

/**
 * TenantGuard - Componente que garante que um tenant válido está selecionado
 * antes de renderizar o conteúdo protegido
 */
export function TenantGuard({ children }: TenantGuardProps) {
  const { loading, isAuthenticated } = useTenantContext();

  // Mostra loading enquanto verifica cache
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não tem tenant selecionado, mostra seletor
  if (!isAuthenticated) {
    return <TenantSelector />;
  }

  // Tenant válido, renderiza conteúdo protegido
  return <>{children}</>;
}
