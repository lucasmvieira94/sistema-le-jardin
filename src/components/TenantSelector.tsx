import { useState } from 'react';
import { Building2, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantContext } from '@/contexts/TenantContext';

interface TenantSelectorProps {
  onSuccess?: () => void;
}

export function TenantSelector({ onSuccess }: TenantSelectorProps) {
  const [employerCode, setEmployerCode] = useState('');
  const [error, setError] = useState('');
  const { validateEmployerCode, validating } = useTenantContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!employerCode.trim()) {
      setError('Por favor, insira o código da empresa');
      return;
    }

    const result = await validateEmployerCode(employerCode);

    if (!result.success) {
      setError(result.error || 'Código inválido');
      return;
    }

    // Sucesso! O TenantGuard automaticamente vai renderizar o conteúdo
    onSuccess?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 sm:space-y-4 text-center px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold">Selecione sua Empresa</CardTitle>
            <CardDescription className="mt-1.5 sm:mt-2 text-sm sm:text-base">
              Para acessar o sistema, insira o código exclusivo da sua instituição
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 py-4 sm:py-6">
            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="employerCode" className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Código da Empresa
              </label>
              <Input
                id="employerCode"
                type="text"
                placeholder="Digite o código"
                value={employerCode}
                onChange={(e) => setEmployerCode(e.target.value.toUpperCase())}
                disabled={validating}
                maxLength={50}
                className="text-center font-mono text-base sm:text-lg tracking-wider h-11 sm:h-12"
                autoFocus
              />
              <p className="text-xs sm:text-sm text-muted-foreground">
                O código é fornecido pelo administrador da sua instituição
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-4 sm:px-6 pb-6 sm:pb-8">
            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 text-base" 
              disabled={validating || !employerCode.trim()}
            >
              {validating ? (
                <>
                  <span className="animate-pulse">Validando...</span>
                </>
              ) : (
                <>
                  Acessar Sistema
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>

            <div className="text-xs sm:text-sm text-center text-muted-foreground space-y-0.5 sm:space-y-1">
              <p>Não possui um código de acesso?</p>
              <p>Entre em contato com o administrador do sistema</p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
