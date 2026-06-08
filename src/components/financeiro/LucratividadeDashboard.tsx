import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, Lightbulb } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { CATEGORIAS } from "@/hooks/financeiro/useContasPagar";

const fmtBRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labelCat = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;
const PIE_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#a855f7", "#ef4444", "#eab308", "#14b8a6", "#6366f1", "#ec4899", "#84cc16", "#f59e0b", "#64748b"];

type Mensalidade = { competencia: string; valor_total: number; valor_pago: number; status: string; data_pagamento: string | null };
type Conta = { categoria: string; fornecedor: string | null; valor: number; data_pagamento: string | null; status: string; data_vencimento: string };

function monthKey(d: string) { return d.slice(0, 7); }
function monthLabel(k: string) { const [y, m] = k.split("-"); return `${m}/${y.slice(2)}`; }

export default function LucratividadeDashboard() {
  const [loading, setLoading] = useState(true);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const inicio12 = new Date();
      inicio12.setMonth(inicio12.getMonth() - 11);
      inicio12.setDate(1);
      const limite = inicio12.toISOString().slice(0, 10);
      const [m, c] = await Promise.all([
        (supabase as any).from("mensalidades_residentes")
          .select("competencia, valor_total, valor_pago, status, data_pagamento")
          .gte("competencia", limite),
        (supabase as any).from("contas_pagar")
          .select("categoria, fornecedor, valor, data_pagamento, status, data_vencimento")
          .gte("data_vencimento", limite),
      ]);
      setMensalidades((m.data as Mensalidade[]) ?? []);
      setContas((c.data as Conta[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const hoje = new Date();
  const mesAtualKey = hoje.toISOString().slice(0, 7);
  const mesAnteriorDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorKey = mesAnteriorDate.toISOString().slice(0, 7);

  const dadosMensais = useMemo(() => {
    const map: Record<string, { receita: number; despesa: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      map[d.toISOString().slice(0, 7)] = { receita: 0, despesa: 0 };
    }
    mensalidades.forEach((m) => {
      const k = monthKey(m.competencia);
      if (map[k]) map[k].receita += Number(m.valor_pago || 0);
    });
    contas.forEach((c) => {
      if (c.status !== "pago" || !c.data_pagamento) return;
      const k = monthKey(c.data_pagamento);
      if (map[k]) map[k].despesa += Number(c.valor || 0);
    });
    return Object.entries(map).map(([k, v]) => ({
      mes: monthLabel(k), key: k,
      receita: v.receita, despesa: v.despesa, lucro: v.receita - v.despesa,
    }));
  }, [mensalidades, contas]);

  const mesAtual = dadosMensais.find((d) => d.key === mesAtualKey) ?? { receita: 0, despesa: 0, lucro: 0 };
  const mesAnterior = dadosMensais.find((d) => d.key === mesAnteriorKey) ?? { receita: 0, despesa: 0, lucro: 0 };

  const margem = mesAtual.receita > 0 ? (mesAtual.lucro / mesAtual.receita) * 100 : 0;
  const variacao = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100);
  const varReceita = variacao(mesAtual.receita, mesAnterior.receita);
  const varDespesa = variacao(mesAtual.despesa, mesAnterior.despesa);
  const varLucro = variacao(mesAtual.lucro, mesAnterior.lucro);

  // Despesas por categoria — mês atual
  const despesasCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    contas.forEach((c) => {
      if (c.status !== "pago" || !c.data_pagamento) return;
      if (monthKey(c.data_pagamento) !== mesAtualKey) return;
      map[c.categoria] = (map[c.categoria] ?? 0) + Number(c.valor || 0);
    });
    return Object.entries(map).map(([categoria, valor]) => ({ categoria: labelCat(categoria), valor })).sort((a, b) => b.valor - a.valor);
  }, [contas, mesAtualKey]);

  const topFornecedores = useMemo(() => {
    const map: Record<string, number> = {};
    contas.forEach((c) => {
      if (c.status !== "pago" || !c.data_pagamento) return;
      if (monthKey(c.data_pagamento) !== mesAtualKey) return;
      const f = c.fornecedor || "(sem fornecedor)";
      map[f] = (map[f] ?? 0) + Number(c.valor || 0);
    });
    return Object.entries(map).map(([f, v]) => ({ fornecedor: f, valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [contas, mesAtualKey]);

  // Projeção de fechamento
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diaAtual = hoje.getDate();
  const projecaoReceita = (mesAtual.receita / diaAtual) * diasNoMes;
  const projecaoDespesa = (mesAtual.despesa / Math.max(diaAtual, 1)) * diasNoMes;
  const projecaoLucro = projecaoReceita - projecaoDespesa;

  const inadimplencia = useMemo(() =>
    mensalidades
      .filter((m) => monthKey(m.competencia) === mesAtualKey && (m.status === "pendente" || m.status === "vencido" || m.status === "parcial"))
      .reduce((s, m) => s + (Number(m.valor_total) - Number(m.valor_pago)), 0),
    [mensalidades, mesAtualKey]);

  const contasAVencer30 = useMemo(() => {
    const limite = new Date(); limite.setDate(limite.getDate() + 30);
    return contas
      .filter((c) => (c.status === "pendente" || c.status === "atrasado") && new Date(c.data_vencimento) <= limite)
      .reduce((s, c) => s + Number(c.valor || 0), 0);
  }, [contas]);

  // Insights automáticos
  const insights = useMemo(() => {
    const arr: { tipo: "info" | "warning" | "success"; texto: string }[] = [];
    if (despesasCategoria[0]) {
      const top = despesasCategoria[0];
      const pct = mesAtual.despesa > 0 ? (top.valor / mesAtual.despesa) * 100 : 0;
      arr.push({ tipo: "info", texto: `Maior despesa do mês: ${top.categoria} (${fmtBRL(top.valor)}, ${pct.toFixed(0)}% do total).` });
    }
    if (margem < 10 && mesAtual.receita > 0) {
      arr.push({ tipo: "warning", texto: `Margem de lucro baixa (${margem.toFixed(1)}%). Revise despesas ou ajuste valores.` });
    } else if (margem >= 25) {
      arr.push({ tipo: "success", texto: `Margem saudável de ${margem.toFixed(1)}%. Bom desempenho neste mês.` });
    }
    if (varDespesa > 20 && mesAnterior.despesa > 0) {
      arr.push({ tipo: "warning", texto: `Despesas subiram ${varDespesa.toFixed(0)}% vs mês anterior. Vale revisar fornecedores.` });
    }
    if (varLucro < -20 && mesAnterior.lucro > 0) {
      arr.push({ tipo: "warning", texto: `Lucro caiu ${Math.abs(varLucro).toFixed(0)}% comparado ao mês anterior.` });
    }
    if (varReceita > 10) {
      arr.push({ tipo: "success", texto: `Receita cresceu ${varReceita.toFixed(0)}% em relação ao mês anterior.` });
    }
    if (inadimplencia > 0) {
      arr.push({ tipo: "warning", texto: `Inadimplência em aberto neste mês: ${fmtBRL(inadimplencia)}. Acione cobranças.` });
    }
    if (contasAVencer30 > 0) {
      arr.push({ tipo: "info", texto: `Próximos 30 dias: ${fmtBRL(contasAVencer30)} em contas a vencer.` });
    }
    arr.push({ tipo: "info", texto: `Projeção de fechamento: receita ${fmtBRL(projecaoReceita)}, despesa ${fmtBRL(projecaoDespesa)}, lucro ${fmtBRL(projecaoLucro)}.` });
    return arr;
  }, [despesasCategoria, mesAtual, margem, varDespesa, varLucro, varReceita, mesAnterior, inadimplencia, contasAVencer30, projecaoReceita, projecaoDespesa, projecaoLucro]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando indicadores...</div>;
  }

  const VarBadge = ({ v }: { v: number }) => {
    if (!isFinite(v) || v === 0) return null;
    const pos = v >= 0;
    return (
      <span className={`text-xs inline-flex items-center gap-0.5 ${pos ? "text-emerald-600" : "text-red-600"}`}>
        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pos ? "+" : ""}{v.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-700">{fmtBRL(mesAtual.receita)}</div>
            <VarBadge v={varReceita} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Despesa do Mês</CardTitle>
            <Wallet className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-700">{fmtBRL(mesAtual.despesa)}</div>
            <VarBadge v={varDespesa} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${mesAtual.lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtBRL(mesAtual.lucro)}</div>
            <VarBadge v={varLucro} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Margem</CardTitle>
            <Badge variant={margem >= 20 ? "default" : margem >= 10 ? "secondary" : "destructive"}>
              {margem.toFixed(1)}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Inadimplência: {fmtBRL(inadimplencia)}</div>
            <div className="text-xs text-muted-foreground">A vencer 30d: {fmtBRL(contasAVencer30)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-yellow-600" /> Insights do negócio</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.map((i, idx) => (
              <li key={idx} className={`text-sm flex gap-2 items-start p-2 rounded border-l-4 ${
                i.tipo === "warning" ? "border-red-500 bg-red-500/5" :
                i.tipo === "success" ? "border-emerald-500 bg-emerald-500/5" :
                "border-blue-500 bg-blue-500/5"
              }`}>
                {i.tipo === "warning" ? <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" /> :
                  i.tipo === "success" ? <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> :
                  <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
                {i.texto}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita vs Despesa (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend />
                <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} name="Receita" />
                <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} name="Despesa" />
                <Line type="monotone" dataKey="lucro" stroke="#6366f1" strokeWidth={2} name="Lucro" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria (mês)</CardTitle></CardHeader>
          <CardContent>
            {despesasCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem despesas pagas neste mês.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={despesasCategoria} dataKey="valor" nameKey="categoria" outerRadius={90} label={(e: any) => e.categoria}>
                    {despesasCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Lucro líquido mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Bar dataKey="lucro" name="Lucro">
                  {dadosMensais.map((d, i) => (
                    <Cell key={i} fill={d.lucro >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top 5 fornecedores do mês</CardTitle></CardHeader>
          <CardContent>
            {topFornecedores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem pagamentos a fornecedores neste mês.</p>
            ) : (
              <ul className="space-y-2">
                {topFornecedores.map((f, i) => (
                  <li key={i} className="flex items-center justify-between border-b pb-1 last:border-0">
                    <span className="text-sm">{i + 1}. {f.fornecedor}</span>
                    <span className="text-sm font-semibold">{fmtBRL(f.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
