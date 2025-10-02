import { useState } from 'react';
import { Building2, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/hooks/useTenant';

interface TenantSelectorProps {
  onSuccess?: () => void;
}

export function TenantSelector({ onSuccess }: TenantSelectorProps) {
  const [employerCode, setEmployerCode] = useState('');
  const [error, setError] = useState('');
  const { validateEmployerCode, validating } = useTenant();

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

    // Sucesso! Redirecionar ou atualizar UI
    onSuccess?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Selecione sua Empresa</CardTitle>
            <CardDescription className="mt-2">
              Para acessar o sistema, insira o código exclusivo da sua instituição
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
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
                placeholder="Digite o código (ex: EMPRESA2025)"
                value={employerCode}
                onChange={(e) => setEmployerCode(e.target.value.toUpperCase())}
                disabled={validating}
                maxLength={50}
                className="text-center font-mono text-lg tracking-wider"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O código é fornecido pelo administrador da sua instituição
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
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

            <div className="text-xs text-center text-muted-foreground space-y-1">
              <p>Não possui um código de acesso?</p>
              <p>Entre em contato com o administrador do sistema</p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
