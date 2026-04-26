import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, CheckCircle2, RefreshCw, AlertOctagon } from 'lucide-react';
import { toast } from 'sonner';

interface Fatura {
  id: string;
  tenant_id: string;
  assinatura_id: string;
  numero: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  metodo_pagamento: string | null;
  link_pagamento: string | null;
  tenant?: { nome: string };
}

interface AssinaturaOpt {
  id: string;
  tenant_id: string;
  valor_contratado: number;
  tenant?: { nome: string };
}

export default function FaturasSaaS() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [assinaturas, setAssinaturas] = useState<AssinaturaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState<'gerar' | 'inadimplencia' | null>(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    assinatura_id: '', numero: '', valor: 0,
    data_vencimento: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    metodo_pagamento: 'boleto', link_pagamento: '',
  });

  const carregar = async () => {
    const [fRes, aRes] = await Promise.all([
      supabase.from('faturas').select('*, tenant:tenants(nome)').order('data_vencimento', { ascending: false }),
      supabase.from('assinaturas').select('id, tenant_id, valor_contratado, tenant:tenants(nome)'),
    ]);
    setFaturas((fRes.data as any) ?? []);
    setAssinaturas((aRes.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const gerarFaturasMes = async () => {
    setExecutando('gerar');
    const { data, error } = await supabase.rpc('gerar_faturas_mensais' as any);
    setExecutando(null);
    if (error) { toast.error(error.message); return; }
    const qtd = (data as any)?.[0]?.faturas_geradas ?? 0;
    toast.success(`${qtd} fatura(s) gerada(s)`);
    carregar();
  };

  const processarInadimplencia = async () => {
    setExecutando('inadimplencia');
    const { data, error } = await supabase.rpc('processar_inadimplencia' as any);
    setExecutando(null);
    if (error) { toast.error(error.message); return; }
    const r = (data as any)?.[0];
    toast.success(`${r?.tenants_suspensos ?? 0} tenant(s) suspenso(s) · ${r?.avisos_enviados ?? 0} aviso(s) pendente(s)`);
    carregar();
  };

  const criar = async () => {
    const ass = assinaturas.find((a) => a.id === form.assinatura_id);
    if (!ass) { toast.error('Selecione uma assinatura'); return; }
    if (!form.numero) { toast.error('Informe o número da fatura'); return; }
    const { error } = await supabase.from('faturas').insert({
      assinatura_id: ass.id,
      tenant_id: ass.tenant_id,
      numero: form.numero,
      valor: form.valor || ass.valor_contratado,
      data_vencimento: form.data_vencimento,
      metodo_pagamento: form.metodo_pagamento,
      link_pagamento: form.link_pagamento || null,
      status: 'pendente',
    } as any);
    if (error) toast.error(error.message);
    else { toast.success('Fatura criada'); setDialog(false); carregar(); }
  };

  const marcarPaga = async (id: string) => {
    const { error } = await supabase.from('faturas').update({
      status: 'paga', data_pagamento: new Date().toISOString().slice(0, 10)
    } as any).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Fatura marcada como paga'); carregar(); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faturas</h1>
          <p className="text-sm text-muted-foreground">Cobranças geradas para as empresas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={gerarFaturasMes} disabled={executando !== null}>
            {executando === 'gerar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Gerar faturas do mês
          </Button>
          <Button variant="outline" onClick={processarInadimplencia} disabled={executando !== null}>
            {executando === 'inadimplencia' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertOctagon className="w-4 h-4 mr-2" />}
            Processar inadimplência
          </Button>
          <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova fatura</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Assinatura</Label>
                <Select value={form.assinatura_id} onValueChange={(v) => {
                  const a = assinaturas.find(x => x.id === v);
                  setForm({ ...form, assinatura_id: v, valor: a?.valor_contratado ?? 0 });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {assinaturas.map(a => <SelectItem key={a.id} value={a.id}>{a.tenant?.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Número da fatura</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="FAT-2026-0001" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={form.metodo_pagamento} onValueChange={(v) => setForm({ ...form, metodo_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Link de pagamento (opcional)</Label>
                <Input value={form.link_pagamento} onChange={(e) => setForm({ ...form, link_pagamento: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={criar}>Criar</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <div className="divide-y divide-border">
          {faturas.map(f => (
            <div key={f.id} className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              <div className="md:col-span-2">
                <p className="font-medium">{f.numero}</p>
                <p className="text-xs text-muted-foreground">{f.tenant?.nome}</p>
              </div>
              <p className="text-sm">R$ {Number(f.valor).toFixed(2)}</p>
              <div className="text-xs text-muted-foreground">
                Vence: {new Date(f.data_vencimento).toLocaleDateString('pt-BR')}
                {f.data_pagamento && <><br />Pago: {new Date(f.data_pagamento).toLocaleDateString('pt-BR')}</>}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Badge variant={f.status === 'paga' ? 'default' : f.status === 'vencida' ? 'destructive' : 'secondary'}>
                  {f.status}
                </Badge>
                {f.status !== 'paga' && (
                  <Button size="sm" variant="ghost" onClick={() => marcarPaga(f.id)}>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {faturas.length === 0 && <div className="p-8 text-center text-muted-foreground">Nenhuma fatura.</div>}
        </div>
      </Card>
    </div>
  );
}