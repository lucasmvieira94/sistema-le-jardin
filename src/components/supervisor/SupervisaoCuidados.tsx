import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, Baby, CalendarDays, CheckCircle2, ClipboardList, FileText, Pill, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { analisarSupervisao, type PainelSupervisao, type PendenciaSupervisao } from '@/utils/supervisaoCuidados';
import { formatarData, formatarDataHora } from '@/utils/dateUtils';
import { DetalhesRotinaDialog } from '@/components/cuidados/RotinasDia';
import type { RotinaCuidado } from '@/utils/rotinasCuidados';

const labels: Record<string, string> = { rotinas: 'Rotinas', medicamentos: 'Medicamentos', agenda: 'Compromissos', prontuario: 'Prontuários', atrasado: 'Atrasado', agora: 'Agora', proximo: 'Próximo', 'sem estoque': 'Sem estoque', 'não visto': 'Não visto', 'sem registro': 'Sem registro' };
const horaBR = (iso: string) => formatarDataHora(iso).split(' ')[1];

export default function SupervisaoCuidados({ data, hora, onIntercorrencias, criticas }: { data: PainelSupervisao; hora: string; onIntercorrencias: () => void; criticas: number }) {
  const navigate = useNavigate();
  const [residente, setResidente] = useState('todos');
  const [modulo, setModulo] = useState('todos');
  const [status, setStatus] = useState('pendentes');
  const [busca, setBusca] = useState('');
  const [equipe, setEquipe] = useState('todos');
  const [rotina, setRotina] = useState<RotinaCuidado | null>(null);
  const [detalhe, setDetalhe] = useState<PendenciaSupervisao | null>(null);
  const analise = useMemo(() => analisarSupervisao(data, hora), [data, hora]);
  const pendencias = analise.pendencias.filter(p => (residente === 'todos' || p.residente_id === residente) && (modulo === 'todos' || p.modulo === modulo) && (status !== 'atrasados' || p.status === 'atrasado' || p.status === 'sem estoque') && `${p.residente} ${p.titulo}`.toLowerCase().includes(busca.toLowerCase()));
  const rotinasFeitas = analise.rotinas.filter(o => o.status === 'feito').length;
  const dosesFeitas = analise.mapa.doses.filter(o => o.status === 'administrado').length;
  const ciencia = data.agenda.filter(a => a.visto_em).length;
  const registrados = data.residentes.filter(r => data.ciclos.some(c => c.residente_id === r.id && c.data_ciclo === data.dia && c.registros > 0)).length;
  const atividades = data.atividades.filter(a => (residente === 'todos' || a.residente_id === residente) && (equipe === 'todos' || a.funcionario_nome === equipe));
  const abrir = (p: PendenciaSupervisao) => {
    if (p.modulo === 'rotinas') { setRotina(data.rotinas.find(r => `r-${r.id}-` === p.id.slice(0, `r-${r.id}-`.length)) ?? null); }
    else setDetalhe(p);
  };
  const cards = [
    { icon: ClipboardList, label: 'Rotinas realizadas', feito: rotinasFeitas, total: analise.rotinas.length },
    { icon: Pill, label: 'Doses registradas', feito: dosesFeitas, total: analise.mapa.doses.length },
    { icon: CalendarDays, label: 'Compromissos vistos', feito: ciencia, total: data.agenda.length },
    { icon: FileText, label: 'Residentes com registros', feito: registrados, total: data.residentes.length },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Cuidados de hoje</h2><p className="text-sm text-muted-foreground">{formatarData(data.dia)} · {data.residentes.length} residentes · horário de Brasília</p></div>
      <Button variant="outline" onClick={() => navigate('/cuidados')}><ArrowUpRight className="mr-2 h-4 w-4" />Portal de Cuidados</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(c => <Card key={c.label}><CardContent className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><c.icon className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">{c.total ? Math.round(c.feito / c.total * 100) : 0}%</span></div><p className="text-2xl font-semibold">{c.feito}<span className="text-base font-normal text-muted-foreground"> / {c.total}</span></p><p className="mt-1 min-h-10 text-sm text-muted-foreground">{c.label}</p><Progress className="mt-2 h-1.5" value={c.total ? c.feito / c.total * 100 : 0} /></CardContent></Card>)}
    </div>
    <section className="space-y-3" aria-label="Insights do plantão">
      <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" />Atenção do supervisor</h3>
      {criticas > 0 && <Button variant="destructive" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={onIntercorrencias}>{criticas} intercorrência(s) crítica(s) em aberto<ArrowUpRight className="ml-auto h-4 w-4 shrink-0" /></Button>}
      {analise.insights.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{analise.insights.map(i => <Card key={i.titulo} className="border-destructive/30"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="text-2xl font-semibold text-destructive">{i.numero}</span><div className="min-w-0"><h4 className="text-sm font-semibold">{i.titulo}</h4><p className="mt-1 text-sm text-muted-foreground">{i.acao}</p></div></div></CardContent></Card>)}</div> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Nenhuma pendência prioritária identificada nos registros.</p>}
      <p className="text-xs text-muted-foreground">Indicadores de registros, não avaliação de desempenho. “Visto” confirma ciência; ausência de registro não comprova ausência de cuidado.</p>
    </section>
    <Tabs defaultValue="pendencias" className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="pendencias"><ClipboardList className="mr-2 h-4 w-4" />Pendências</TabsTrigger>
        <TabsTrigger value="equipe"><Users className="mr-2 h-4 w-4" />Equipe e atividades</TabsTrigger>
        <TabsTrigger value="estoques"><Baby className="mr-2 h-4 w-4" />Estoques e saúde</TabsTrigger>
      </TabsList>
      <div className="flex flex-wrap gap-2">
        <Select value={residente} onValueChange={setResidente}><SelectTrigger className="w-full sm:w-64" aria-label="Filtrar residente"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os residentes</SelectItem>{data.residentes.map(r => <SelectItem key={r.id} value={r.id}>{r.nome_completo}</SelectItem>)}</SelectContent></Select>
      </div>
      <TabsContent value="pendencias" className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar pendência" placeholder="Residente ou atividade" value={busca} onChange={e => setBusca(e.target.value)} /></div>
          <Select value={modulo} onValueChange={setModulo}><SelectTrigger aria-label="Filtrar atividade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as atividades</SelectItem>{['rotinas','medicamentos','agenda','prontuario'].map(m => <SelectItem key={m} value={m}>{labels[m]}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtrar urgência"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendentes">Todas as pendências</SelectItem><SelectItem value="atrasados">Atrasadas / sem estoque</SelectItem></SelectContent></Select>
        </div>
        <p className="text-sm text-muted-foreground">{pendencias.length} pendência(s)</p>
        <div className="divide-y border-y">
          {pendencias.length ? pendencias.map(p => <Button key={p.id} variant="ghost" onClick={() => abrir(p)} className="h-auto w-full justify-start gap-3 rounded-none px-2 py-4 text-left whitespace-normal"><div className="min-w-0 flex-1"><p className="font-semibold">{p.titulo}</p><p className="mt-1 text-sm font-normal text-muted-foreground">{p.residente} · {labels[p.modulo]} · {p.horario}</p></div><Badge className="shrink-0" variant={p.status === 'atrasado' || p.status === 'sem estoque' ? 'destructive' : 'secondary'}>{labels[p.status]}</Badge><ArrowUpRight className="hidden h-4 w-4 shrink-0 sm:block" /></Button>) : <p className="py-8 text-center text-muted-foreground">Nenhuma pendência para estes filtros.</p>}
        </div>
      </TabsContent>
      <TabsContent value="equipe" className="space-y-4">
        <h3 className="font-semibold">Atividades registradas por cuidadora</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.equipe.map(e => <Card key={e.id}><CardContent className="p-4"><p className="font-semibold break-words">{e.nome_completo}</p><p className="mt-2 text-sm">{e.total} registro(s) hoje</p><p className="text-xs text-muted-foreground">Último registro às {horaBR(e.ultima_atividade)}</p></CardContent></Card>)}</div>
        {!data.equipe.length && <p className="text-sm text-muted-foreground">Nenhuma atividade registrada pela equipe hoje.</p>}
        <Select value={equipe} onValueChange={setEquipe}><SelectTrigger className="w-full sm:w-72" aria-label="Filtrar cuidadora"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Toda a equipe</SelectItem>{data.equipe.map(e => <SelectItem key={e.id} value={e.nome_completo}>{e.nome_completo}</SelectItem>)}</SelectContent></Select>
        <h3 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" />Últimas atividades do dia</h3>
        <ul className="divide-y border-y">{atividades.map((a, i) => <li key={`${a.momento}-${i}`} className="flex gap-3 py-3"><time className="text-sm text-muted-foreground">{horaBR(a.momento)}</time><div className="min-w-0"><p className="text-sm font-medium">{a.categoria} · {a.detalhe}</p><p className="text-sm text-muted-foreground">{a.funcionario_nome ?? 'Registro institucional'}{a.residente_nome ? ` · ${a.residente_nome}` : ''}</p></div></li>)}</ul>
        {!atividades.length && <p className="text-sm text-muted-foreground">Nenhuma atividade para os filtros.</p>}
        <p className="text-xs text-muted-foreground">Até 100 atividades recentes; totais da equipe incluem todos os registros do dia.</p>
      </TabsContent>
      <TabsContent value="estoques" className="space-y-5">
        <div className="grid gap-6 md:grid-cols-2"><section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Pill className="h-4 w-4" />Medicamentos em alerta</h3>{analise.medBaixos.filter(e => residente === 'todos' || e.residente_id === residente).map(e => <div key={e.id} className="border-b py-3"><p className="text-sm font-medium">{e.nome} · {e.quantidade_atual} disponível(is)</p><p className="text-sm text-muted-foreground">{e.residente_nome ?? 'Estoque de emergência'}{e.lote ? ` · Lote ${e.lote}` : ''}{e.data_validade ? ` · Validade ${formatarData(e.data_validade)}` : ''}</p></div>)}{!analise.medBaixos.length && <p className="text-sm text-muted-foreground">Nenhum estoque em alerta.</p>}</section>
          <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Baby className="h-4 w-4" />Fraldas em alerta</h3>{analise.fraldasBaixas.filter(e => residente === 'todos' || e.residente_nome === data.residentes.find(r => r.id === residente)?.nome_completo).map(e => <div key={e.id} className="border-b py-3"><p className="text-sm font-medium">{e.residente_nome ?? 'Geral'} · {e.tipo_fralda} {e.tamanho}</p><p className="text-sm text-muted-foreground">{e.quantidade_atual} unidade(s) · aproximadamente {Math.floor(e.quantidade_atual / (e.consumo_medio_diario || 4))} dia(s)</p></div>)}{!analise.fraldasBaixas.length && <p className="text-sm text-muted-foreground">Nenhum estoque em alerta.</p>}</section></div>
        <div className="border-t pt-4 text-sm"><p>Conservação dos medicamentos: {data.temperatura.registros} medição(ões) hoje · {data.temperatura.fora_conformidade} fora de conformidade.</p><p className="mt-2">Vacinas: {data.vacinas_pendentes} próxima(s) dose(s) com data até hoje para conferir.</p><p className="mt-2">Remoções: {data.remocoes_pendentes} pedido(s) aguardando decisão do gestor.</p></div>
      </TabsContent>
    </Tabs>
    <DetalhesRotinaDialog rotina={rotina} onClose={() => setRotina(null)} />
    <Dialog open={!!detalhe} onOpenChange={open => { if (!open) setDetalhe(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{detalhe?.titulo}</DialogTitle></DialogHeader>{detalhe && <div className="space-y-4"><p>{detalhe.residente} · {detalhe.horario}</p><Badge variant="secondary">{labels[detalhe.status]}</Badge>{detalhe.modulo === 'agenda' && <p className="whitespace-pre-wrap">{data.agenda.find(a => `a-${a.id}` === detalhe.id)?.observacoes || 'Sem observações adicionais.'}</p>}<Button onClick={() => navigate(`/cuidados/${detalhe.modulo}`)}><ArrowUpRight className="mr-2 h-4 w-4" />Abrir {labels[detalhe.modulo]}</Button></div>}</DialogContent></Dialog>
  </div>;
}