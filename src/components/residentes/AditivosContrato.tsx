import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatarData, hojeISO } from '@/utils/dateUtils';
import { validarProrrogacao, type AditivoData } from '@/utils/aditivoContrato';
import type { ContratoData } from './types';
import type { DistratoData } from './DistratoForm';
import AditivoDocumento from './AditivoDocumento';

export default function AditivosContrato({ contrato, distrato, onClose, onSaved }: { contrato: ContratoData; distrato?: DistratoData; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const [aditivos, setAditivos] = useState<AditivoData[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [condicoes, setCondicoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [visualizar, setVisualizar] = useState<AditivoData | null>(null);
  const [pedidoId, setPedidoId] = useState(() => crypto.randomUUID());
  const prazo = distrato ? distrato.prazo_prorrogado ?? distrato.data_efetiva : contrato.prazo_prorrogado ?? contrato.data_fim_contrato ?? null;
  const valido = validarProrrogacao(novaData, prazo, hojeISO());
  const carregar = useCallback(async () => {
    if (!contrato.id) return;
    setCarregando(true); setErro('');
    const { data, error } = await supabase.from('contratos_aditivos').select('*').eq('contrato_id', contrato.id).order('created_at', { ascending: false });
    if (error) setErro('Não foi possível carregar os aditivos.');
    else setAditivos((data ?? []) as unknown as AditivoData[]);
    setCarregando(false);
  }, [contrato.id]);
  useEffect(() => { carregar(); }, [carregar]);
  const salvar = async () => {
    if (!contrato.id || !valido || salvando) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('criar_aditivo_prorrogacao', {
        _id: pedidoId, _contrato: contrato.id, _distrato: distrato?.id ?? null,
        _nova_data: novaData, _condicoes: condicoes.trim(), _prazo_atual: prazo,
      });
      if (error) throw error;
      setFormulario(false); setNovaData(''); setCondicoes(''); setPedidoId(crypto.randomUUID());
      setVisualizar(data as unknown as AditivoData);
      toast({ title: 'Aditivo criado', description: `Novo término: ${formatarData(novaData)}.` });
      await Promise.all([carregar(), onSaved()]);
    } catch (e) { toast({ title: 'Não foi possível criar o aditivo', description: e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Tente novamente.', variant: 'destructive' }); }
    finally { setSalvando(false); }
  };
  return <>
    <Dialog open onOpenChange={open => { if (!open && !salvando) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[95dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Aditivos · {contrato.numero_contrato}</DialogTitle><DialogDescription>{distrato ? `Distrato ${distrato.numero_distrato}` : 'Contrato do residente'} · Término vigente: {prazo ? formatarData(prazo) : 'Indeterminado'}</DialogDescription></DialogHeader>
        {!formulario ? <Button disabled={contrato.status === 'encerrado' || carregando || !!erro} onClick={() => setFormulario(true)}><CalendarPlus className="w-4 h-4 mr-2"/>Prorrogar {distrato ? 'distrato' : 'contrato'}</Button> : <form onSubmit={e => { e.preventDefault(); salvar(); }} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="aditivo-prazo">Novo término</Label><Input id="aditivo-prazo" type="date" required value={novaData} onChange={e => setNovaData(e.target.value)} disabled={salvando}/>{novaData && !valido && <p role="alert" className="text-sm text-destructive">Escolha uma data posterior ao prazo vigente e à data de hoje.</p>}</div>
          <div className="space-y-2"><Label htmlFor="aditivo-condicoes">Condições adicionais (opcional)</Label><Textarea id="aditivo-condicoes" rows={4} maxLength={5000} value={condicoes} disabled={salvando} onChange={e => setCondicoes(e.target.value)}/></div>
          <p className="text-sm text-muted-foreground">Ao confirmar, o novo prazo passa a valer no sistema, mesmo antes da assinatura. O documento original e seus valores permanecem preservados. Não haverá cobrança automática pela prorrogação.</p>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={() => setFormulario(false)}>Cancelar</Button><Button type="submit" disabled={salvando || !valido}>{salvando ? 'Criando…' : 'Confirmar prorrogação'}</Button></div>
        </form>}
        <section className="border-t pt-4 space-y-3"><h3 className="font-semibold">Histórico de aditivos</h3>
          {carregando ? <p className="text-muted-foreground">Carregando…</p> : erro ? <div role="alert"><p className="text-destructive">{erro}</p><Button variant="outline" onClick={carregar}>Tentar novamente</Button></div> : aditivos.length === 0 ? <p className="text-muted-foreground">Nenhum aditivo registrado.</p> : aditivos.map(a => <div key={a.id} className="border rounded-md p-3 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 break-words"><p className="font-medium">{a.numero_aditivo}</p><p className="text-sm text-muted-foreground">{a.data_anterior ? formatarData(a.data_anterior) : 'Indeterminado'} → {formatarData(a.nova_data)}</p><Badge variant="outline">{a.distrato_id ? 'Distrato' : 'Contrato'}</Badge></div><Button variant="outline" size="sm" onClick={() => setVisualizar(a)}><Eye className="w-4 h-4 mr-2"/>Ver documento</Button></div>)}
        </section>
      </DialogContent>
    </Dialog>
    {visualizar && <AditivoDocumento aditivo={visualizar} onClose={() => setVisualizar(null)}/>}
  </>;
}