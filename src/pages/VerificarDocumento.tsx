import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldX, Loader2, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataHora } from "@/utils/dateUtils";

interface VerificacaoResult {
  autentico: boolean;
  tipo?: string;
  tipo_label?: string;
  numero_documento?: string | null;
  titular_mascarado?: string;
  emitido_em?: string;
  motivo?: string;
}

export default function VerificarDocumento() {
  const [params] = useSearchParams();
  const [id, setId] = useState(params.get("id") || "");
  const [hash, setHash] = useState(params.get("hash") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificacaoResult | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const verificar = async () => {
    if (!id.trim() || !hash.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("verificar-documento", {
        body: { id: id.trim(), hash: hash.trim() },
      });
      if (error) throw error;
      setResult(data as VerificacaoResult);
    } catch (e: any) {
      setResult({ autentico: false, motivo: e?.message || "Falha ao verificar" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit quando vem do QR Code
  useEffect(() => {
    if (!autoSubmitted && params.get("id") && params.get("hash")) {
      setAutoSubmitted(true);
      verificar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <FileSearch className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Verificação de Autenticidade</h1>
          <p className="text-sm text-muted-foreground">
            Informe o ID e o código (hash SHA-256) impressos no rodapé do documento, ou escaneie o QR Code.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-id">ID do Documento</Label>
              <Input id="doc-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-hash">Hash SHA-256</Label>
              <Input id="doc-hash" value={hash} onChange={(e) => setHash(e.target.value)} placeholder="64 caracteres hexadecimais" className="font-mono text-xs" />
            </div>
            <Button onClick={verificar} disabled={loading || !id || !hash} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando…</> : "Verificar Autenticidade"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Alert variant={result.autentico ? "default" : "destructive"} className={result.autentico ? "border-green-500/50 bg-green-500/5" : ""}>
            {result.autentico ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldX className="h-5 w-5" />
            )}
            <AlertTitle className={result.autentico ? "text-green-700" : ""}>
              {result.autentico ? "Documento Autêntico" : "Documento Inválido ou Alterado"}
            </AlertTitle>
            <AlertDescription className="space-y-1 mt-2">
              {result.autentico ? (
                <>
                  <p>O hash informado corresponde ao registro original e o conteúdo não foi alterado.</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div><strong>Tipo:</strong> {result.tipo_label || "—"}</div>
                    {result.numero_documento && <div><strong>Número:</strong> {result.numero_documento}</div>}
                    {result.titular_mascarado && <div><strong>Titular:</strong> {result.titular_mascarado}</div>}
                    {result.emitido_em && <div><strong>Emitido em:</strong> {formatarDataHora(result.emitido_em)}</div>}
                  </div>
                </>
              ) : (
                <p>{result.motivo || "Não foi possível confirmar a integridade. Verifique se o ID e o hash foram digitados corretamente."}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Apenas dados mínimos para conferência são exibidos publicamente, em conformidade com a LGPD (Lei 13.709/2018).
        </p>
      </div>
    </main>
  );
}