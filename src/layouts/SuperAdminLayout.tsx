import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSuperAdmin } from '@/hooks/saas/useSuperAdmin';
import { useAuthSession } from '@/hooks/useAuthSession';
import { Loader2, LayoutDashboard, Building2, Package, Receipt, FileText, ArrowLeft, ShieldAlert, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin-saas', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin-saas/empresas', label: 'Empresas', icon: Building2 },
  { to: '/admin-saas/planos', label: 'Planos', icon: Package },
  { to: '/admin-saas/assinaturas', label: 'Assinaturas', icon: Receipt },
  { to: '/admin-saas/faturas', label: 'Faturas', icon: FileText },
  { to: '/admin-saas/auditoria-uso', label: 'Auditoria de uso', icon: Activity },
];

export function SuperAdminLayout() {
  const { isSuperAdmin, loading: loadingRole } = useSuperAdmin();
  const { user, loading: loadingAuth } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  // Aguarda tanto a sessão quanto a verificação de papel antes de decidir.
  if (loadingAuth || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1) Não autenticado → vai para o login do sistema preservando o destino.
  if (!user) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirectTo}`} replace />;
  }

  // 2) Autenticado, mas sem o papel super_admin → tela de acesso negado.
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <ShieldAlert className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="text-muted-foreground text-sm">
            Esta área é exclusiva para operadores da plataforma.
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Plataforma SaaS</p>
              <p className="text-xs text-muted-foreground">Painel da operação</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao app
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}