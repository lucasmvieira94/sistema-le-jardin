/**
 * Resumo do prontuário do dia (ciclo 00h00–23h59, UTC-3): lançamentos por
 * residente, divididos por turno, e retificações.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileHeart } from "lucide-react";
import { horaFormatada, type MonitoramentoResidente } from "@/utils/prontuarioLancamentos";

export default function AlertasProntuarios() {
  const [itens, setItens] = useState<MonitoramentoResidente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      const { data, error } = await supabase.rpc("monitorar_prontuarios_dia" as never);
      if (error) console.error("Erro ao carregar prontuários do dia:", error);
      setItens(((data as unknown) as MonitoramentoResidente[]) || []);
      setLoading(false);
    };
    carregar();
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const total = itens.reduce((s, i) => s + i.lancamentos, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileHeart className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Prontuários de hoje — aberto até 23h59</CardTitle>
        </div>
        {!loading && (
          <p className="text-xs text-muted-foreground">{total} lançamento(s) em {itens.length} residente(s)</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum residente ativo.</p>
        ) : (
          itens.map((m) => (
            <div key={m.residente_id} className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{m.residente_nome}</p>
                <Badge variant={m.lancamentos > 0 ? "default" : "outline"} className="text-xs">
                  {m.lancamentos} lançamento(s)
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Diurno: {m.diurno} • Noturno: {m.noturno}
                {m.retificacoes > 0 && ` • Retificações: ${m.retificacoes}`}
                {m.ultimo_lancamento && ` • Último: ${horaFormatada(m.ultimo_lancamento)}${m.ultima_autora ? ` por ${m.ultima_autora}` : ""}`}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
