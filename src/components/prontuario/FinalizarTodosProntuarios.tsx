import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Lock, Loader2 } from "lucide-react";

interface FinalizarTodosProntuariosProps {
  onSuccess?: () => void;
}

export default function FinalizarTodosProntuarios({ onSuccess }: FinalizarTodosProntuariosProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'auth'>('confirm');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setStep('confirm');
    setEmail("");
    setPassword("");
    setJustificativa("");
    setLoading(false);
  };

  const handleOpenDialog = () => {
    resetState();
    setDialogOpen(true);
  };

  const handleProceedToAuth = () => {
    if (!justificativa.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Informe o motivo para encerrar todos os prontuários.",
        variant: "destructive",
      });
      return;
    }
    setStep('auth');
  };

  const handleConfirmFinalizar = async () => {
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe email e senha do administrador.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Reautenticar o admin com email/senha
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        toast({
          title: "Autenticação falhou",
          description: "Email ou senha incorretos.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Chamar a função de encerramento em lote
      const { data, error } = await supabase.rpc('finalizar_todos_prontuarios_abertos', {
        p_justificativa: justificativa.trim(),
      });

      if (error) throw error;

      const result = data as any;

      if (result?.success) {
        toast({
          title: "Prontuários encerrados",
          description: result.message,
        });
        setDialogOpen(false);
        resetState();
        onSuccess?.();
      } else {
        toast({
          title: "Erro",
          description: result?.message || "Não foi possível encerrar os prontuários.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao finalizar prontuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleOpenDialog}
      >
        <ShieldAlert className="w-4 h-4 mr-2" />
        Encerrar Todos em Aberto
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetState(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" />
              Encerrar Todos os Prontuários em Aberto
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Atenção!</strong> Esta ação encerrará <strong>todos</strong> os prontuários com status "em andamento" ou "não iniciado". Esta ação não pode ser desfeita.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="justificativa-lote">
                  Justificativa (obrigatória para auditoria)
                </Label>
                <Textarea
                  id="justificativa-lote"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Descreva o motivo do encerramento em lote..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleProceedToAuth}
                  disabled={!justificativa.trim()}
                  className="flex-1"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 'auth' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para confirmar, insira suas credenciais de administrador.
              </p>

              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmFinalizar()}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('confirm')}
                  disabled={loading}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmFinalizar}
                  disabled={!email.trim() || !password.trim() || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Confirmar Encerramento'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
