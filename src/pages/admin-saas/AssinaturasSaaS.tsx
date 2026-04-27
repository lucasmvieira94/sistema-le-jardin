import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Row {
  id: string;
  tenant_id: string;
  status: string;
  ciclo: string;
  valor_contratado: number;
  data_inicio: string;
  data_fim_trial: string | null;
  proxima_cobranca: string | null;
  dia_vencimento: number;
  tenant?: { nome: string };
  plano?: { nome: string };
}

const STATUS = ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'];

export default function AssinaturasSaaS() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [trialOpen, setTrialOpen] = useState<string | null>(null);
  const [trialDias, setTrialDias] = useState<number>(14);
  const [trialSaving, setTrialSaving] = useState(false);

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

  const mudarDiaVencimento = async (id: string, dia: number) => {
    if (dia < 1 || dia > 28) { toast.error('Dia deve estar entre 1 e 28'); return; }
    const { error } = await supabase
      .from('assinaturas')
      .update({ dia_vencimento: dia } as any)
      .eq('id', id);
    if (error) toast.error(error.message);
    else toast.success('Dia de vencimento atualizado');
  };

  const liberarTrial = async (row: Row) => {
    if (trialDias < 1 || trialDias > 365) {
      toast.error('Período deve estar entre 1 e 365 dias');
      return;
    }
    setTrialSaving(true);
    try {
      const fim = new Date();
      fim.setDate(fim.getDate() + trialDias);
      const dataFimTrial = fim.toISOString().slice(0, 10);

      // Atualiza assinatura: status trial, datas e zera próxima cobrança
      const { error: errAssin } = await supabase
        .from('assinaturas')
        .update({
          status: 'trial',
          data_fim_trial: dataFimTrial,
          data_inicio: new Date().toISOString().slice(0, 10),
          data_cancelamento: null,
          motivo_cancelamento: null,
          proxima_cobranca: null,
        } as any)
        .eq('id', row.id);
      if (errAssin) throw errAssin;

      // Reativa o tenant se estiver suspenso
      const { error: errTenant } = await supabase
        .from('tenants')
        .update({
          ativo: true,
          data_suspensao: null,
          motivo_suspensao: null,
        } as any)
        .eq('id', row.tenant_id);
      if (errTenant) throw errTenant;

      toast.success(`Trial liberado por ${trialDias} dias até ${fim.toLocaleDateString('pt-BR')}`);
      setTrialOpen(null);
      carregar();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao liberar trial');
    } finally {
      setTrialSaving(false);
    }
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
            <div key={r.id} className="p-4 grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
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
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Dia venc.</p>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={r.dia_vencimento}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== r.dia_vencimento) mudarDiaVencimento(r.id, v);
                  }}
                  className="w-16 h-8"
                />
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
              <Dialog open={trialOpen === r.id} onOpenChange={(o) => { setTrialOpen(o ? r.id : null); if (o) setTrialDias(14); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Gift className="w-4 h-4" /> Liberar trial
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Liberar período de teste</DialogTitle>
                    <DialogDescription>
                      Defina por quantos dias <strong>{r.tenant?.nome ?? 'o cliente'}</strong> terá acesso gratuito.
                      Isso reativa o tenant (caso suspenso), zera a próxima cobrança e marca a assinatura como <em>trial</em>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <Label htmlFor={`dias-${r.id}`}>Dias de teste</Label>
                    <Input
                      id={`dias-${r.id}`}
                      type="number"
                      min={1}
                      max={365}
                      value={trialDias}
                      onChange={(e) => setTrialDias(Number(e.target.value))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {[7, 14, 30, 60, 90].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          variant={trialDias === d ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTrialDias(d)}
                        >
                          {d} dias
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trial encerra em:{' '}
                      <strong>
                        {new Date(Date.now() + trialDias * 86400000).toLocaleDateString('pt-BR')}
                      </strong>
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setTrialOpen(null)} disabled={trialSaving}>
                      Cancelar
                    </Button>
                    <Button onClick={() => liberarTrial(r)} disabled={trialSaving}>
                      {trialSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Confirmar liberação
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ))}
          {rows.length === 0 && <div className="p-8 text-center text-muted-foreground">Nenhuma assinatura.</div>}
        </div>
      </Card>
    </div>
  );
}