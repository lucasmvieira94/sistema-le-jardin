import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Receipt, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Metricas {
  totalTenants: number;
  tenantsAtivos: number;
  emTrial: number;
  inadimplentes: number;
  mrr: number;
  faturasPendentes: number;
  ultimosTenants: Array<{ id: string; nome: string; created_at: string; status: string }>;
}

export default function DashboardSaaS() {
  const [m, setM] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      const [tenantsRes, assinRes, faturasRes] = await Promise.all([
        supabase.from('tenants').select('id, nome, ativo, created_at').order('created_at', { ascending: false }),
        supabase.from('assinaturas').select('status, valor_contratado, ciclo, tenant_id'),
        supabase.from('faturas').select('status, valor').eq('status', 'pendente'),
      ]);

      const assinaturas = assinRes.data ?? [];
      const tenants = tenantsRes.data ?? [];

      // MRR = soma de valor_contratado das ativas (mensalizado)
      const mrr = assinaturas
        .filter((a) => a.status === 'ativa')
        .reduce((acc, a) => acc + (a.ciclo === 'anual' ? a.valor_contratado / 12 : a.valor_contratado), 0);

      const ultimosTenants = tenants.slice(0, 5).map((t) => {
        const ass = assinaturas.find((a) => a.tenant_id === t.id);
        return {
          id: t.id,
          nome: t.nome,
          created_at: t.created_at,
          status: ass?.status ?? 'sem-assinatura',
        };
      });

      setM({
        totalTenants: tenants.length,
        tenantsAtivos: tenants.filter((t) => t.ativo).length,
        emTrial: assinaturas.filter((a) => a.status === 'trial').length,
        inadimplentes: assinaturas.filter((a) => a.status === 'inadimplente').length,
        mrr,
        faturasPendentes: (faturasRes.data ?? []).reduce((acc, f) => acc + Number(f.valor), 0),
        ultimosTenants,
      });
      setLoading(false);
    };
    carregar();
  }, []);

  if (loading || !m) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard da Plataforma</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio SaaS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatBRL(m.mrr)}</p>
            <p className="text-xs text-muted-foreground mt-1">Receita Recorrente Mensal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresas</CardTitle>
            <Building2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{m.tenantsAtivos}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.totalTenants} no total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Trial</CardTitle>
            <Receipt className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{m.emTrial}</p>
            <p className="text-xs text-muted-foreground mt-1">Aguardando conversão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inadimplência</CardTitle>
            <AlertCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{m.inadimplentes}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBRL(m.faturasPendentes)} pendentes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas empresas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {m.ultimosTenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="font-medium">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge variant={t.status === 'ativa' ? 'default' : t.status === 'trial' ? 'secondary' : 'outline'}>
                  {t.status}
                </Badge>
              </div>
            ))}
            {m.ultimosTenants.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}