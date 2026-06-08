import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Wallet, ArrowRight } from "lucide-react";
import { formatarData } from "@/utils/dateUtils";

const fmtBRL = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ContaAlerta = {
  id: string; descricao: string; valor: number; data_vencimento: string;
  status: "pendente" | "atrasado"; fornecedor: string | null;
};

export default function AlertasContasPagar() {
  const [contas, setContas] = useState<ContaAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await (supabase as any).rpc("marcar_contas_atrasadas").catch(() => {});
      const limite = new Date(); limite.setDate(limite.getDate() + 7);
      const { data } = await (supabase as any)
        .from("contas_pagar")
        .select("id, descricao, valor, data_vencimento, status, fornecedor")
        .in("status", ["pendente", "atrasado"])
        .lte("data_vencimento", limite.toISOString().slice(0, 10))
        .order("data_vencimento", { ascending: true })
        .limit(8);
      setContas((data as ContaAlerta[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const total = contas.reduce((s, c) => s + Number(c.valor), 0);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Contas a Pagar
        </CardTitle>
        <Link to="/financeiro?tab=contas-pagar">
          <Button size="sm" variant="ghost">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">Carregando...</p>
        ) : contas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhuma conta vencendo nos próximos 7 dias. 🎉</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              {contas.length} conta(s) — Total: <span className="font-semibold text-foreground">{fmtBRL(total)}</span>
            </div>
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {contas.map((c) => {
                const atrasado = c.status === "atrasado" || c.data_vencimento < hoje;
                const venceHoje = c.data_vencimento === hoje;
                return (
                  <li key={c.id} className={`flex items-center justify-between p-2 rounded text-sm border-l-4 ${
                    atrasado ? "border-red-500 bg-red-500/5" : venceHoje ? "border-yellow-500 bg-yellow-500/5" : "border-muted bg-muted/30"
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-1">
                        {atrasado && <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />}
                        {c.descricao}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatarData(c.data_vencimento)}
                        {atrasado && <Badge variant="destructive" className="ml-1 text-[10px] py-0">Atrasado</Badge>}
                        {venceHoje && !atrasado && <Badge className="ml-1 text-[10px] py-0 bg-yellow-500">Hoje</Badge>}
                      </div>
                    </div>
                    <div className="text-sm font-semibold shrink-0 ml-2">{fmtBRL(Number(c.valor))}</div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
