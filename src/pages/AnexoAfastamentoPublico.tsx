import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function AnexoAfastamentoPublico() {
  const { token } = useParams();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let currentUrl: string | null = null;
    const controller = new AbortController();
    async function load() {
      if (!token) { setError('Link inválido.'); return; }
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-anexo-afastamento?token=${encodeURIComponent(token)}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error ?? 'Documento indisponível.');
        }
        currentUrl = URL.createObjectURL(await response.blob());
        setUrl(currentUrl);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Documento indisponível.');
      }
    }
    void load();
    return () => { controller.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [token]);
  return <main className="min-h-screen bg-background text-foreground p-4 sm:p-8">
    <header className="max-w-5xl mx-auto border-b pb-4 mb-6 flex items-center justify-between gap-4">
      <div><p className="text-sm text-muted-foreground">Senex Care</p><h1 className="text-xl font-semibold">Documento de afastamento</h1></div>
      {url && <Button asChild variant="outline"><a href={url} download="afastamento-autenticado.pdf">Baixar PDF</a></Button>}
    </header>
    {error ? <div className="max-w-5xl mx-auto flex gap-2 text-destructive"><FileWarning />{error}</div> : url ?
      <iframe title="PDF autenticado do afastamento" src={url} className="block w-full max-w-5xl mx-auto h-[75vh] border" /> :
      <div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" />Verificando documento…</div>}
  </main>;
}