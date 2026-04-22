import { ReactNode } from 'react';
import { useTenantModulos, ModuloKey } from '@/hooks/saas/useTenantModulos';
import { Card } from '@/components/ui/card';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  modulo: ModuloKey;
  children: ReactNode;
}

/**
 * Bloqueia o conteúdo se o tenant não tem o módulo contratado.
 * Mostra um upsell com link para a página de assinatura.
 */
export function ModuleGuard({ modulo, children }: Props) {
  const { isHabilitado, loading } = useTenantModulos();
  const navigate = useNavigate();

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isHabilitado(modulo)) {
    return (
      <div className="p-8 flex justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">Módulo não contratado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Este recurso não está incluído no seu plano atual. Faça upgrade para liberar.
            </p>
          </div>
          <Button onClick={() => navigate('/configuracoes/assinatura')}>Ver minha assinatura</Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}