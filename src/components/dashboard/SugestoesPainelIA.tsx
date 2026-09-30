/**
 * Quadro do agente "Consultor do painel": lista sugestões da IA com motivo
 * e permite aplicar (altera a personalização) ou dispensar.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/hooks/useAuthSession";
import { QUADROS, type PreferenciasPainel, aplicarSugestao } from "./registroQuadros";
import { formatarDataHora } from "@/utils/dateUtils";

interface Sugestao {
  id: string;
  tipo: "adicionar" | "remover" | "reordenar";
  quadro: string;
  posicao: number | null;
  motivo: string;
  analisado_em: string;
}

const ROTULO_TIPO = { adicionar: "Mostrar", remover: "Ocultar", reordenar: "Mover" } as const;

export default function SugestoesPainelIA({ pref, onSalvar }: { pref: PreferenciasPainel; onSalvar: (p: PreferenciasPainel) => Promise<void> }) {
  const [itens, setItens] = useState<Sugestao[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthSession();

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).from("dashboard_sugestoes_ia")
      .select("id, tipo, quadro, posicao, motivo, analisado_em").eq("status", "pendente")
      .order("analisado_em", { ascending: false }).limit(10);
    setItens(data || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (s: Sugestao, status: "aplicada" | "dispensada") => {
    try {
      if (status === "aplicada") await onSalvar(aplicarSugestao(pref, s));
      const { error } = await (supabase as any).from("dashboard_sugestoes_ia")
        .update({ status, decidido_por: user?.id, decidido_em: new Date().toISOString() }).eq("id", s.id);
      if (error) throw error;
      setItens((x) => x.filter((i) => i.id !== s.id));
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" });
    }
  };

  const analisar = async () => {
    setAnalisando(true);
    try {
      const { data, error } = await supabase.functions.invoke("consultor-painel", { body: {} });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Análise concluída", description: `${(data as any)?.sugestoes ?? 0} sugestão(ões) nova(s).` });
      await carregar();
    } catch (e: any) {
      toast({ title: "Análise não concluída", description: e.message, variant: "destructive" });
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Sugestões para o painel</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={analisar} disabled={analisando}>
            {analisando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Analisar agora
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A IA analisa o uso do sistema e as pendências toda semana. Nada muda sem sua confirmação.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão pendente.</p>
        ) : itens.map((s) => (
          <div key={s.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">{ROTULO_TIPO[s.tipo]}</Badge>
              <span className="text-sm font-medium">{QUADROS.find((q) => q.id === s.quadro)?.titulo || s.quadro}</span>
              <span className="text-xs text-muted-foreground ml-auto">{formatarDataHora(s.analisado_em)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{s.motivo}</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => decidir(s, "dispensada")}>Dispensar</Button>
              <Button size="sm" onClick={() => decidir(s, "aplicada")}>Aplicar</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
