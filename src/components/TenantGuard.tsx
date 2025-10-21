import { ReactNode } from 'react';
import { TenantSelector } from './TenantSelector';
import { useTenantContext } from '@/contexts/TenantContext';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface TenantGuardProps {
  children: ReactNode;
}

// Rotas que não precisam de tenant (públicas)
const PUBLIC_ROUTES = ['/auth', '/', '/funcionario-access', '/registro-ponto', '/prontuario', '/temperatura-medicamentos'];

/**
 * TenantGuard - Componente que garante que um tenant válido está selecionado
 * antes de renderizar o conteúdo protegido (exceto rotas públicas)
 */
export function TenantGuard({ children }: TenantGuardProps) {
  const { loading, isAuthenticated } = useTenantContext();
  const location = useLocation();

  // Verifica se é rota pública
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

  // Mostra loading enquanto verifica cache (apenas para rotas protegidas)
  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se é rota pública, permite acesso sem tenant
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Se não tem tenant selecionado em rota protegida, mostra seletor
  if (!isAuthenticated) {
    return <TenantSelector />;
  }

  // Tenant válido, renderiza conteúdo protegido
  return <>{children}</>;
}
