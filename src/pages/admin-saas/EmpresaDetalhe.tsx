import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Save, Building2, Settings2, CreditCard, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { MODULOS_DISPONIVEIS, type ModuloKey } from '@/hooks/saas/useTenantModulos';

interface Tenant {
  id: string; nome: string; cnpj: string | null; endereco: string | null;
  logo_url: string | null; ativo: boolean;
}
interface ConfigEmpresa {
  id?: string; tenant_id?: string; nome_empresa: string; cnpj: string | null;
  endereco: string | null; cidade: string | null; logo_url: string | null;
  geofence_ativo: boolean; geofence_latitude: number | null; geofence_longitude: number | null;
  geofence_raio_metros: number; intervalo_minimo_minutos: number | null;
  hora_inicio_noturno: string | null; hora_fim_noturno: string | null;
  adicional_noturno: number | null; adicional_hora_extra_50: number | null;
  adicional_hora_extra_100: number | null;
}
interface Plano { id: string; nome: string; }
interface Assinatura {
  id: string; tenant_id: string; plano_id: string; status: string; ciclo: string;
  valor_contratado: number; data_inicio: string; data_fim_trial: string | null;
  proxima_cobranca: string | null; dia_vencimento: number;
}
interface ModuloRow { modulo: string; habilitado: boolean; }

const STATUS = ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'];

export default function EmpresaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [modulos, setModulos] = useState<Record<string, boolean>>({});

  const carregar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [tRes, cRes, aRes, pRes, mRes] = await Promise.all([
        supabase.from('tenants').select('id,nome,cnpj,endereco,logo_url,ativo').eq('id', id).maybeSingle(),
        supabase.from('configuracoes_empresa').select('*').eq('tenant_id', id).maybeSingle(),
        supabase.from('assinaturas').select('*').eq('tenant_id', id).maybeSingle(),
        supabase.from('planos').select('id,nome').eq('ativo', true).order('ordem'),
        supabase.from('tenant_modulos').select('modulo,habilitado').eq('tenant_id', id),
      ]);
      if (tRes.error) throw tRes.error;
      setTenant(tRes.data as any);
      setConfig((cRes.data as any) ?? {
        nome_empresa: tRes.data?.nome ?? '', cnpj: tRes.data?.cnpj ?? null,
        endereco: tRes.data?.endereco ?? null, cidade: null, logo_url: tRes.data?.logo_url ?? null,
        geofence_ativo: false, geofence_latitude: null, geofence_longitude: null,
        geofence_raio_metros: 150, intervalo_minimo_minutos: 60,
        hora_inicio_noturno: '22:00:00', hora_fim_noturno: '05:00:00',
        adicional_noturno: 20, adicional_hora_extra_50: 50, adicional_hora_extra_100: 100,
      });
      setAssinatura((aRes.data as any) ?? null);
      setPlanos((pRes.data as any) ?? []);
      const map: Record<string, boolean> = {};
      ((mRes.data as any) ?? []).forEach((m: ModuloRow) => { map[m.modulo] = !!m.habilitado; });
      setModulos(map);
    } catch (e: any) {
      toast.error('Erro ao carregar empresa: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [id]);

  // ---- Cadastro (tenants) ----
  const salvarCadastro = async () => {
    if (!tenant) return;
    if (!tenant.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      nome: tenant.nome.trim(),
      cnpj: tenant.cnpj?.trim() || null,
      endereco: tenant.endereco?.trim() || null,
      logo_url: tenant.logo_url?.trim() || null,
      ativo: tenant.ativo,
    } as any).eq('id', tenant.id);
    setSaving(false);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Cadastro atualizado');
  };

  // ---- Operacional (configuracoes_empresa) ----
  const salvarOperacional = async () => {
    if (!config || !id) return;
    setSaving(true);
    const payload: any = { ...config, tenant_id: id };
    delete payload.id;
    const { error } = config.id
      ? await supabase.from('configuracoes_empresa').update(payload).eq('id', config.id)
      : await supabase.from('configuracoes_empresa').insert(payload);
    setSaving(false);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Configurações operacionais salvas'); carregar(); }
  };

  // ---- Assinatura ----
  const salvarAssinatura = async () => {
    if (!assinatura) return;
    setSaving(true);
    const { error } = await supabase.from('assinaturas').update({
      plano_id: assinatura.plano_id,
      status: assinatura.status,
      ciclo: assinatura.ciclo,
      valor_contratado: assinatura.valor_contratado,
      dia_vencimento: assinatura.dia_vencimento,
      data_fim_trial: assinatura.data_fim_trial,
      proxima_cobranca: assinatura.proxima_cobranca,
    } as any).eq('id', assinatura.id);
    setSaving(false);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Assinatura atualizada');
  };

  // ---- Módulos ----
  const toggleModulo = async (key: ModuloKey, valor: boolean) => {
    if (!id) return;
    setModulos((prev) => ({ ...prev, [key]: valor })); // otimista
    const { error } = await supabase.from('tenant_modulos').upsert({
      tenant_id: id, modulo: key, habilitado: valor, habilitado_em: new Date().toISOString(),
    } as any, { onConflict: 'tenant_id,modulo' });
    if (error) {
      toast.error('Erro: ' + error.message);
      setModulos((prev) => ({ ...prev, [key]: !valor })); // rollback
    } else {
      toast.success(`Módulo ${valor ? 'habilitado' : 'desabilitado'}`);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!tenant) return <div className="p-6">Empresa não encontrada.</div>;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate('/admin-saas/empresas')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {tenant.nome}
            {!tenant.ativo && <Badge variant="destructive">Suspensa</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">Gestão completa da empresa-cliente</p>
        </div>
      </div>

      <Tabs defaultValue="cadastro" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="cadastro"><Building2 className="w-4 h-4 mr-1" /> Cadastro</TabsTrigger>
          <TabsTrigger value="operacional"><Settings2 className="w-4 h-4 mr-1" /> Operacional</TabsTrigger>
          <TabsTrigger value="assinatura"><CreditCard className="w-4 h-4 mr-1" /> Assinatura</TabsTrigger>
          <TabsTrigger value="modulos"><Boxes className="w-4 h-4 mr-1" /> Módulos</TabsTrigger>
        </TabsList>

        {/* CADASTRO */}
        <TabsContent value="cadastro">
          <Card className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da empresa *</Label>
                <Input value={tenant.nome} onChange={(e) => setTenant({ ...tenant, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={tenant.cnpj ?? ''} onChange={(e) => setTenant({ ...tenant, cnpj: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço</Label>
                <Input value={tenant.endereco ?? ''} onChange={(e) => setTenant({ ...tenant, endereco: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>URL do Logo</Label>
                <Input value={tenant.logo_url ?? ''} onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Switch checked={tenant.ativo} onCheckedChange={(v) => setTenant({ ...tenant, ativo: v })} />
                <Label>Empresa ativa</Label>
              </div>
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={salvarCadastro} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar cadastro
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* OPERACIONAL */}
        <TabsContent value="operacional">
          {config && (
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-medium mb-3">Identificação</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome exibido nos documentos</Label>
                    <Input value={config.nome_empresa} onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade / UF (rodapé documentos)</Label>
                    <Input value={config.cidade ?? ''} onChange={(e) => setConfig({ ...config, cidade: e.target.value })} placeholder="São Paulo / SP" />
                  </div>
                </div>
              </div>

              <Separator />
              <div>
                <h3 className="font-medium mb-3">Geofence (controle de ponto)</h3>
                <div className="flex items-center gap-3 mb-3">
                  <Switch checked={config.geofence_ativo} onCheckedChange={(v) => setConfig({ ...config, geofence_ativo: v })} />
                  <Label>Geofence ativo</Label>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={config.geofence_latitude ?? ''} onChange={(e) => setConfig({ ...config, geofence_latitude: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={config.geofence_longitude ?? ''} onChange={(e) => setConfig({ ...config, geofence_longitude: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Raio (m)</Label>
                    <Input type="number" value={config.geofence_raio_metros} onChange={(e) => setConfig({ ...config, geofence_raio_metros: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              <Separator />
              <div>
                <h3 className="font-medium mb-3">Jornada e adicionais</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início horário noturno</Label>
                    <Input type="time" value={(config.hora_inicio_noturno ?? '22:00:00').slice(0, 5)} onChange={(e) => setConfig({ ...config, hora_inicio_noturno: e.target.value + ':00' })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim horário noturno</Label>
                    <Input type="time" value={(config.hora_fim_noturno ?? '05:00:00').slice(0, 5)} onChange={(e) => setConfig({ ...config, hora_fim_noturno: e.target.value + ':00' })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Adicional noturno (%)</Label>
                    <Input type="number" step="0.01" value={config.adicional_noturno ?? 0} onChange={(e) => setConfig({ ...config, adicional_noturno: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo mínimo entre pontos (min)</Label>
                    <Input type="number" value={config.intervalo_minimo_minutos ?? 60} onChange={(e) => setConfig({ ...config, intervalo_minimo_minutos: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Adicional hora extra 50%</Label>
                    <Input type="number" step="0.01" value={config.adicional_hora_extra_50 ?? 0} onChange={(e) => setConfig({ ...config, adicional_hora_extra_50: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Adicional hora extra 100%</Label>
                    <Input type="number" step="0.01" value={config.adicional_hora_extra_100 ?? 0} onChange={(e) => setConfig({ ...config, adicional_hora_extra_100: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <Separator />
              <div className="flex justify-end">
                <Button onClick={salvarOperacional} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar operacional
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ASSINATURA */}
        <TabsContent value="assinatura">
          {assinatura ? (
            <Card className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={assinatura.plano_id} onValueChange={(v) => setAssinatura({ ...assinatura, plano_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={assinatura.status} onValueChange={(v) => setAssinatura({ ...assinatura, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ciclo</Label>
                  <Select value={assinatura.ciclo} onValueChange={(v) => setAssinatura({ ...assinatura, ciclo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor contratado (R$)</Label>
                  <Input type="number" step="0.01" value={assinatura.valor_contratado} onChange={(e) => setAssinatura({ ...assinatura, valor_contratado: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Dia de vencimento (1-28)</Label>
                  <Input type="number" min={1} max={28} value={assinatura.dia_vencimento} onChange={(e) => setAssinatura({ ...assinatura, dia_vencimento: Number(e.target.value) || 1 })} />
                </div>
                <div className="space-y-2">
                  <Label>Fim do trial</Label>
                  <Input type="date" value={assinatura.data_fim_trial ?? ''} onChange={(e) => setAssinatura({ ...assinatura, data_fim_trial: e.target.value || null })} />
                </div>
                <div className="space-y-2">
                  <Label>Próxima cobrança</Label>
                  <Input type="date" value={assinatura.proxima_cobranca ?? ''} onChange={(e) => setAssinatura({ ...assinatura, proxima_cobranca: e.target.value || null })} />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={salvarAssinatura} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar assinatura
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              Esta empresa ainda não possui assinatura.
            </Card>
          )}
        </TabsContent>

        {/* MÓDULOS */}
        <TabsContent value="modulos">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Habilite ou desabilite módulos individualmente. As alterações são salvas automaticamente.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {MODULOS_DISPONIVEIS.map((m) => (
                <div key={m.key} className="flex items-start justify-between gap-4 p-3 border border-border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.descricao}</p>
                  </div>
                  <Switch checked={!!modulos[m.key]} onCheckedChange={(v) => toggleModulo(m.key, v)} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
