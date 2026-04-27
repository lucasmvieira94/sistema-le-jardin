import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

const SUPABASE_URL = "https://kvjgmqicictxxfnvhuwl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2amdtcWljaWN0eHhmbnZodXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5NDU3NzIsImV4cCI6MjA2NTUyMTc3Mn0.gGPP76kvvjC6pKZMV9mbJawcccGKdMnLT1SLq6s56rY";

type State =
  | { status: "loading" }
  | { status: "valid"; email?: string }
  | { status: "already" }
  | { status: "invalid"; message: string }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "invalid", message: "Token não informado." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ status: "invalid", message: data?.error || "Link inválido ou expirado." });
          return;
        }
        if (data?.already_unsubscribed) {
          setState({ status: "already" });
          return;
        }
        setState({ status: "valid", email: data?.email });
      } catch (e: any) {
        setState({ status: "invalid", message: e?.message || "Falha ao validar token." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ status: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.success || (data as any)?.already_unsubscribed) {
        setState({ status: "success" });
      } else {
        setState({ status: "error", message: (data as any)?.error || "Não foi possível concluir." });
      }
    } catch (e: any) {
      setState({ status: "error", message: e?.message || "Falha ao processar." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <MailX className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Cancelar inscrição de e-mails</CardTitle>
          <CardDescription>Senex Care</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state.status === "loading" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validando link…</p>
            </div>
          )}

          {state.status === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                {state.email ? (
                  <>Confirme o cancelamento para <strong>{state.email}</strong>.</>
                ) : (
                  <>Confirme o cancelamento de inscrição.</>
                )}
              </p>
              <Button onClick={confirm} className="w-full">Confirmar cancelamento</Button>
            </>
          )}

          {state.status === "submitting" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processando…</p>
            </div>
          )}

          {state.status === "success" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">Inscrição cancelada</p>
              <p className="text-sm text-muted-foreground">Você não receberá mais nossos e-mails.</p>
            </div>
          )}

          {state.status === "already" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">Já cancelado</p>
              <p className="text-sm text-muted-foreground">Este e-mail já está fora da lista.</p>
            </div>
          )}

          {(state.status === "invalid" || state.status === "error") && (
            <div className="flex flex-col items-center gap-2 py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Não foi possível continuar</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}