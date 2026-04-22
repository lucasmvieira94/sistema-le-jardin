import { useSubscription } from '@/hooks/saas/useSubscription';
import { useTenantModulos, MODULOS_DISPONIVEIS } from '@/hooks/saas/useTenantModulos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

export default function MinhaAssinatura() {
  const { assinatura, plano, uso, loading, diasTrialRestantes, limitesProximos } = useSubscription();
  const { isHabilitado } = useTenantModulos();
  const { tenantId } = useTenantContext();
  const [faturas, setFaturas] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from('faturas').select('*').eq('tenant_id', tenantId)
      .order('data_vencimento', { ascending: false }).limit(10)
      .then(({ data }) => setFaturas(data ?? []));
  }, [tenantId]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!assinatura || !plano) {
    return <div className="p-8 text-center text-muted-foreground">Sua empresa ainda não possui assinatura ativa.</div>;
  }

  const pct = (atual: number, max: number) => Math.min(100, (atual / Math.max(1, max)) * 100);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Minha Assinatura</h1>
        <p className="text-sm text-muted-foreground">Plano contratado, uso e faturas</p>
      </div>

      {diasTrialRestantes !== null && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Você está em período de avaliação</p>
              <p className="text-sm text-muted-foreground">
                Restam <strong>{diasTrialRestantes} dia(s)</strong> de trial. Entre em contato para contratar o plano definitivo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Plano atual
              <Badge variant={assinatura.status === 'ativa' ? 'default' : 'secondary'}>{assinatura.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{plano.nome}</p>
            <p className="text-sm text-muted-foreground">{plano.descricao}</p>
            <p className="text-sm">
              R$ {Number(assinatura.valor_contratado).toFixed(2)} / {assinatura.ciclo}
            </p>
            {assinatura.proxima_cobranca && (
              <p className="text-xs text-muted-foreground">
                Próxima cobrança: {new Date(assinatura.proxima_cobranca).toLocaleDateString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Uso atual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Funcionários</span>
                <span>{uso?.funcionarios_ativos ?? 0} / {plano.limite_funcionarios}</span>
              </div>
              <Progress value={pct(uso?.funcionarios_ativos ?? 0, plano.limite_funcionarios)} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Residentes</span>
                <span>{uso?.residentes_ativos ?? 0} / {plano.limite_residentes}</span>
              </div>
              <Progress value={pct(uso?.residentes_ativos ?? 0, plano.limite_residentes)} />
            </div>
            {limitesProximos.length > 0 && (
              <p className="text-xs text-destructive">⚠ Você está se aproximando do limite do plano.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Módulos contratados</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MODULOS_DISPONIVEIS.map(m => {
              const ok = isHabilitado(m.key);
              return (
                <div key={m.key} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                  <span className={ok ? '' : 'text-muted-foreground line-through'}>{m.nome}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas faturas</CardTitle></CardHeader>
        <CardContent>
          {faturas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {faturas.map(f => (
                <div key={f.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{f.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {new Date(f.data_vencimento).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>R$ {Number(f.valor).toFixed(2)}</span>
                    <Badge variant={f.status === 'paga' ? 'default' : f.status === 'vencida' ? 'destructive' : 'secondary'}>
                      {f.status}
                    </Badge>
                    {f.link_pagamento && f.status !== 'paga' && (
                      <a href={f.link_pagamento} target="_blank" rel="noreferrer" className="text-primary text-xs underline">Pagar</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}