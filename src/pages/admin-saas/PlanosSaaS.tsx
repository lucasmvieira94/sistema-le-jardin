import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Edit, Package } from 'lucide-react';
import { toast } from 'sonner';
import { MODULOS_DISPONIVEIS } from '@/hooks/saas/useTenantModulos';
import type { Plano } from '@/hooks/saas/useSubscription';

const EMPTY: Partial<Plano> = {
  nome: '', slug: '', descricao: '', preco_mensal: 0, preco_anual: 0,
  limite_funcionarios: 10, limite_residentes: 20, limite_usuarios_admin: 1,
  modulos_inclusos: ['ponto', 'escala', 'prontuario'], ordem: 0, destaque: false, ativo: true,
};

export default function PlanosSaaS() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Partial<Plano>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    const { data } = await supabase.from('planos').select('*').order('ordem');
    setPlanos((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrir = (p?: Plano) => {
    setEdit(p ?? EMPTY);
    setDialog(true);
  };

  const salvar = async () => {
    if (!edit.nome || !edit.slug) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }
    setSaving(true);
    const payload = { ...edit };
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    const { error } = edit.id
      ? await supabase.from('planos').update(payload as any).eq('id', edit.id)
      : await supabase.from('planos').insert(payload as any);

    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Plano salvo!');
      setDialog(false);
      carregar();
    }
    setSaving(false);
  };

  const toggleModulo = (key: string) => {
    const atual = edit.modulos_inclusos ?? [];
    setEdit({
      ...edit,
      modulos_inclusos: atual.includes(key) ? atual.filter((m) => m !== key) : [...atual, key],
    });
  };

  if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planos comerciais</h1>
          <p className="text-sm text-muted-foreground">Catálogo de planos vendáveis</p>
        </div>
        <Button onClick={() => abrir()}><Plus className="w-4 h-4 mr-2" />Novo plano</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planos.map((p) => (
          <Card key={p.id} className={`p-5 ${p.destaque ? 'border-primary' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-lg">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.slug}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => abrir(p)}><Edit className="w-4 h-4" /></Button>
            </div>
            <p className="text-2xl font-semibold mt-3">
              R$ {Number(p.preco_mensal).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-xs text-muted-foreground">ou R$ {Number(p.preco_anual).toFixed(2)}/ano</p>
            <p className="text-sm mt-3 text-muted-foreground">{p.descricao}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>👥 Até {p.limite_funcionarios} funcionários</p>
              <p>🏠 Até {p.limite_residentes} residentes</p>
              <p>🛡️ {p.limite_usuarios_admin} admin(s)</p>
              <p>📦 {p.modulos_inclusos.length} módulos</p>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {!p.ativo && <Badge variant="destructive">Inativo</Badge>}
              {p.destaque && <Badge>Destaque</Badge>}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit.id ? 'Editar plano' : 'Novo plano'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={edit.nome ?? ''} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={edit.slug ?? ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descrição</Label>
              <Textarea value={edit.descricao ?? ''} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Preço mensal (R$)</Label>
              <Input type="number" step="0.01" value={edit.preco_mensal ?? 0} onChange={(e) => setEdit({ ...edit, preco_mensal: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Preço anual (R$)</Label>
              <Input type="number" step="0.01" value={edit.preco_anual ?? 0} onChange={(e) => setEdit({ ...edit, preco_anual: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Funcionários</Label>
              <Input type="number" value={edit.limite_funcionarios ?? 0} onChange={(e) => setEdit({ ...edit, limite_funcionarios: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Residentes</Label>
              <Input type="number" value={edit.limite_residentes ?? 0} onChange={(e) => setEdit({ ...edit, limite_residentes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Admins</Label>
              <Input type="number" value={edit.limite_usuarios_admin ?? 0} onChange={(e) => setEdit({ ...edit, limite_usuarios_admin: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Ordem</Label>
              <Input type="number" value={edit.ordem ?? 0} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={!!edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!edit.destaque} onCheckedChange={(v) => setEdit({ ...edit, destaque: v })} />
                <Label>Plano em destaque</Label>
              </div>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Módulos inclusos</Label>
              <div className="grid grid-cols-2 gap-2 border border-border rounded-md p-3 max-h-60 overflow-y-auto">
                {MODULOS_DISPONIVEIS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(edit.modulos_inclusos ?? []).includes(m.key)}
                      onChange={() => toggleModulo(m.key)}
                    />
                    <span>{m.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}