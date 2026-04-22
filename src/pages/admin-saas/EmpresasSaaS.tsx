import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Building2, Eye, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface TenantRow {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
  assinatura?: { status: string; plano?: { nome: string } };
}

export default function EmpresasSaaS() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: '', cnpj: '', employer_code: '' });
  const [novoCriado, setNovoCriado] = useState<{ codigo: string; nome: string } | null>(null);
  const navigate = useNavigate();

  const carregar = async () => {
    setLoading(true);
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, nome, cnpj, ativo, created_at')
      .order('created_at', { ascending: false });

    const { data: assinaturas } = await supabase
      .from('assinaturas')
      .select('tenant_id, status, plano:planos(nome)');

    const merged = (tenantsData ?? []).map((t) => ({
      ...t,
      assinatura: (assinaturas ?? []).find((a: any) => a.tenant_id === t.id) as any,
    }));
    setTenants(merged);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const criar = async () => {
    if (!form.nome.trim() || !form.employer_code.trim()) {
      toast.error('Nome e código de acesso são obrigatórios');
      return;
    }
    if (form.employer_code.length < 6) {
      toast.error('O código deve ter pelo menos 6 caracteres');
      return;
    }
    setCreating(true);
    try {
      // Gerar hash via função pg encode/digest
      const { data, error } = await supabase.rpc('create_tenant_with_code' as any, {
        p_nome: form.nome.trim(),
        p_cnpj: form.cnpj.trim() || null,
        p_employer_code: form.employer_code.trim().toUpperCase(),
      });

      if (error) {
        // Fallback: inserir direto com hash gerado client-side via sha-256
        const hash = await sha256(form.employer_code.trim().toUpperCase());
        const { error: insertErr } = await supabase.from('tenants').insert({
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim() || null,
          employer_code_hash: hash,
          ativo: true,
        } as any);
        if (insertErr) throw insertErr;
      }

      toast.success('Empresa cadastrada!');
      setNovoCriado({ codigo: form.employer_code.trim().toUpperCase(), nome: form.nome.trim() });
      setForm({ nome: '', cnpj: '', employer_code: '' });
      setDialog(false);
      carregar();
    } catch (e: any) {
      toast.error('Erro ao criar empresa: ' + (e.message ?? 'desconhecido'));
    } finally {
      setCreating(false);
    }
  };

  const toggleAtivo = async (t: TenantRow) => {
    const { error } = await supabase
      .from('tenants')
      .update({ ativo: !t.ativo } as any)
      .eq('id', t.id);
    if (error) {
      toast.error('Erro ao alterar status');
      return;
    }
    toast.success(t.ativo ? 'Empresa suspensa' : 'Empresa reativada');
    carregar();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas-clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as empresas que usam a plataforma</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar nova empresa-cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome da empresa *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Residencial Aurora" />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>Código de acesso da empresa *</Label>
                <Input
                  value={form.employer_code}
                  onChange={(e) => setForm({ ...form, employer_code: e.target.value.toUpperCase() })}
                  placeholder="AURORA2026"
                />
                <p className="text-xs text-muted-foreground">
                  Será o código usado pelos colaboradores. Mínimo 6 caracteres. Guarde com segurança.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={criar} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar empresa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {novoCriado && (
        <Card className="p-4 border-primary bg-primary/5">
          <p className="text-sm font-medium">Empresa <strong>{novoCriado.nome}</strong> criada com sucesso!</p>
          <p className="text-sm mt-2">Código de acesso: <code className="bg-background px-2 py-1 rounded">{novoCriado.codigo}</code></p>
          <p className="text-xs text-muted-foreground mt-2">⚠️ Anote este código — não será mostrado novamente.</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNovoCriado(null)}>Entendi</Button>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma empresa ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tenants.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{t.nome}</p>
                    {!t.ativo && <Badge variant="destructive">Suspensa</Badge>}
                    {t.assinatura?.status && (
                      <Badge variant={t.assinatura.status === 'ativa' ? 'default' : 'secondary'}>
                        {t.assinatura.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.cnpj ?? 'Sem CNPJ'} · Plano: {t.assinatura?.plano?.nome ?? '—'} · Cadastrada {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin-saas/empresas/${t.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAtivo(t)}>
                    <Power className={t.ativo ? 'w-4 h-4 text-destructive' : 'w-4 h-4 text-primary'} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Helper para gerar SHA-256 (mesmo formato que o Postgres encode/digest hex)
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}