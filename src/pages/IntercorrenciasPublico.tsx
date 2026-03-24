import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, AlertTriangle, Clock, CheckCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { X, ChevronsUpDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useIntercorrencias, IntercorrenciaLog } from '@/hooks/useIntercorrencias';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';

const CATEGORIAS = [
  { value: 'saude_residente', label: 'Saúde do Residente' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'comportamental', label: 'Comportamental' },
  { value: 'medicacao', label: 'Medicação' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-green-100 text-green-800' },
  { value: 'media', label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800' },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-800' },
  resolvida: { label: 'Resolvida', color: 'bg-green-100 text-green-800' },
  encerrada: { label: 'Encerrada', color: 'bg-gray-100 text-gray-800' },
};

export default function IntercorrenciasPublico() {
  useFuncionarioSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get('funcionario_id') || '';
  const funcionarioNome = decodeURIComponent(searchParams.get('funcionario_nome') || '');

  const { intercorrencias, loading, criarIntercorrencia, buscarLogs } = useIntercorrencias(funcionarioId);

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [residenteIds, setResidenteIds] = useState<string[]>([]);
  const [residentePopoverOpen, setResidentePopoverOpen] = useState(false);
  const [residentes, setResidentes] = useState<{ id: string; nome: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<IntercorrenciaLog[]>([]);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('residentes').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => {
      setResidentes((data as any) || []);
    });
  }, []);

  const handleSubmit = async () => {
    if (!titulo.trim() || !descricao.trim() || !categoria) return;
    setSubmitting(true);
    const idsToUse = residenteIds.length > 0 ? residenteIds : [null];
    let success = true;
    for (const rid of idsToUse) {
      const result = await criarIntercorrencia({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria,
        prioridade,
        funcionario_id: funcionarioId,
        ...(rid ? { residente_id: rid } : {}),
      }, funcionarioNome);
      if (!result) success = false;
    }
    if (success) {
      setTitulo('');
      setDescricao('');
      setCategoria('');
      setPrioridade('media');
      setResidenteIds([]);
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handleViewLogs = async (intercorrenciaId: string) => {
    const logs = await buscarLogs(intercorrenciaId);
    setSelectedLogs(logs);
    setLogsDialogOpen(true);
  };

  const prioridadeInfo = (p: string) => PRIORIDADES.find(pr => pr.value === p);
  const categoriaLabel = (c: string) => CATEGORIAS.find(cat => cat.value === c)?.label || c;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/?funcionario_id=${funcionarioId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Intercorrências</h1>
              <p className="text-sm text-muted-foreground">{funcionarioNome}</p>
            </div>
          </div>

          <Tabs defaultValue="registrar" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="registrar">Registrar</TabsTrigger>
              <TabsTrigger value="minhas">Minhas ({intercorrencias.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="registrar" className="space-y-4 mt-4">
              {!showForm ? (
                <Button onClick={() => setShowForm(true)} className="w-full bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" /> Nova Intercorrência
                </Button>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nova Intercorrência</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Título *</Label>
                      <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Resumo da intercorrência" maxLength={200} />
                    </div>
                    <div>
                      <Label>Descrição *</Label>
                      <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva detalhadamente o ocorrido..." rows={4} maxLength={2000} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Categoria *</Label>
                        <Select value={categoria} onValueChange={setCategoria}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={prioridade} onValueChange={setPrioridade}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRIORIDADES.map(p => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Residentes (opcional)</Label>
                      <Popover open={residentePopoverOpen} onOpenChange={setResidentePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                            {residenteIds.length === 0 ? (
                              <span className="text-muted-foreground">Selecione residentes...</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {residenteIds.map(id => {
                                  const r = residentes.find(res => res.id === id);
                                  return r ? (
                                    <Badge key={id} variant="secondary" className="text-xs">
                                      {r.nome}
                                      <button
                                        className="ml-1 hover:text-destructive"
                                        onClick={e => { e.stopPropagation(); setResidenteIds(prev => prev.filter(x => x !== id)); }}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar residente..." />
                            <CommandList>
                              <CommandEmpty>Nenhum residente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {residentes.map(r => (
                                  <CommandItem
                                    key={r.id}
                                    value={r.nome}
                                    onSelect={() => {
                                      setResidenteIds(prev =>
                                        prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id]
                                      );
                                    }}
                                  >
                                    <Checkbox checked={residenteIds.includes(r.id)} className="mr-2" />
                                    {r.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSubmit} disabled={submitting || !titulo.trim() || !descricao.trim() || !categoria} className="flex-1 bg-red-600 hover:bg-red-700">
                        {submitting ? 'Registrando...' : 'Registrar Intercorrência'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="minhas" className="space-y-3 mt-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : intercorrencias.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma intercorrência registrada</p>
              ) : (
                intercorrencias.map(item => {
                  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.aberta;
                  const prInfo = prioridadeInfo(item.prioridade);
                  return (
                    <Card key={item.id} className="border-l-4" style={{ borderLeftColor: item.prioridade === 'critica' ? '#dc2626' : item.prioridade === 'alta' ? '#ea580c' : item.prioridade === 'media' ? '#ca8a04' : '#16a34a' }}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-sm">{item.titulo}</h3>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.descricao}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{categoriaLabel(item.categoria)}</Badge>
                          {prInfo && <Badge className={`${prInfo.color} text-xs`}>{prInfo.label}</Badge>}
                        </div>
                        {item.residentes && (
                          <p className="text-xs text-muted-foreground">Residente: {(item.residentes as any).nome}</p>
                        )}
                        {item.prazo_resolucao && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            Prazo: {new Date(item.prazo_resolucao).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        {item.feedback_gestor && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                            <div className="flex items-center gap-1 font-semibold text-blue-700 mb-1">
                              <MessageSquare className="w-3 h-3" /> Feedback da Gestão
                            </div>
                            <p className="text-blue-900">{item.feedback_gestor}</p>
                            {item.feedback_data && (
                              <p className="text-blue-500 mt-1">{new Date(item.feedback_data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleViewLogs(item.id)}>
                            Ver Histórico
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialog de logs */}
        <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Histórico de Alterações</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum registro</p>
              ) : (
                selectedLogs.map(log => (
                  <div key={log.id} className="border-l-2 border-primary pl-3 py-1">
                    <p className="text-sm font-medium">{log.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.usuario_nome} ({log.usuario_tipo === 'funcionario' ? 'Funcionário' : 'Gestor'}) — {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
