import { AlertOctagon, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TenantSuspendedScreenProps {
  tenantName?: string;
  motivo?: string | null;
  faturaNumero?: string | null;
  linkPagamento?: string | null;
  onSair: () => void;
}

/**
 * Tela exibida quando o tenant está suspenso por inadimplência.
 * Bloqueia totalmente o acesso ao sistema e direciona o usuário
 * para regularizar o pagamento.
 */
export function TenantSuspendedScreen({
  tenantName,
  motivo,
  faturaNumero,
  linkPagamento,
  onSair,
}: TenantSuspendedScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-destructive/5 p-4">
      <Card className="w-full max-w-lg shadow-xl border-destructive/30">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertOctagon className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Acesso Suspenso</CardTitle>
            <CardDescription className="mt-2">
              {tenantName ? `A conta da ${tenantName} está temporariamente bloqueada.` : 'Sua conta está temporariamente bloqueada.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription className="text-sm">
              {motivo || 'Acesso suspenso por inadimplência. Regularize o pagamento para reativar o sistema.'}
            </AlertDescription>
          </Alert>

          {faturaNumero && (
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Fatura em aberto</p>
              <p className="font-semibold text-sm">{faturaNumero}</p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Como regularizar:</p>
            {linkPagamento && (
              <Button asChild className="w-full">
                <a href={linkPagamento} target="_blank" rel="noopener noreferrer">
                  Pagar agora
                </a>
              </Button>
            )}
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="mailto:financeiro@senexcare.com.br" className="flex items-center gap-2 hover:text-foreground">
                <Mail className="w-4 h-4" /> financeiro@senexcare.com.br
              </a>
              <a href="tel:+5500000000000" className="flex items-center gap-2 hover:text-foreground">
                <Phone className="w-4 h-4" /> Suporte financeiro
              </a>
            </div>
          </div>

          <Button variant="outline" onClick={onSair} className="w-full mt-4">
            Trocar de empresa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
