import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  id: string;
  tenant_id: string;
  status: string;
  ciclo: string;
  valor_contratado: number;
  data_inicio: string;
  data_fim_trial: string | null;
  proxima_cobranca: string | null;
  tenant?: { nome: string };
  plano?: { nome: string };
}

const STATUS = ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'];

export default function AssinaturasSaaS() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    const { data } = await supabase
      .from('assinaturas')
      .select('*, tenant:tenants(nome), plano:planos(nome)')
      .order('created_at', { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('assinaturas')
      .update({ status, ...(status === 'cancelada' ? { data_cancelamento: new Date().toISOString() } : {}) } as any)
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Status atualizado'); carregar(); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Assinaturas</h1>
        <p className="text-sm text-muted-foreground">Status e ciclo de cada empresa-cliente</p>
      </div>
      <Card>
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              <div className="md:col-span-2">
                <p className="font-medium">{r.tenant?.nome ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  Plano: {r.plano?.nome ?? '—'} · {r.ciclo} · R$ {Number(r.valor_contratado).toFixed(2)}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Início: {new Date(r.data_inicio).toLocaleDateString('pt-BR')}
                {r.data_fim_trial && (
                  <><br />Trial até: {new Date(r.data_fim_trial).toLocaleDateString('pt-BR')}</>
                )}
              </div>
              <Badge variant={r.status === 'ativa' ? 'default' : r.status === 'inadimplente' ? 'destructive' : 'secondary'}>
                {r.status}
              </Badge>
              <Select value={r.status} onValueChange={(v) => mudarStatus(r.id, v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
          {rows.length === 0 && <div className="p-8 text-center text-muted-foreground">Nenhuma assinatura.</div>}
        </div>
      </Card>
    </div>
  );
}