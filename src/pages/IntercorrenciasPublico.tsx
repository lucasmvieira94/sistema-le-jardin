import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Clock, MessageSquare, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useIntercorrencias, IntercorrenciaLog } from '@/hooks/useIntercorrencias';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';
import { UploadImagensIntercorrencia } from '@/components/intercorrencias/UploadImagensIntercorrencia';

const CATEGORIAS = [
  { value: 'saude_residente', label: 'Saúde do Residente', icon: '🏥' },
  { value: 'infraestrutura', label: 'Infraestrutura', icon: '🏗️' },
  { value: 'comportamental', label: 'Comportamental', icon: '🧠' },
  { value: 'medicacao', label: 'Medicação', icon: '💊' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'media', label: 'Média', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800 border-red-200' },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵' },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🟠' },
  resolvida: { label: 'Resolvida', color: 'bg-green-100 text-green-800 border-green-200', icon: '🟢' },
  encerrada: { label: 'Encerrada', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '⚪' },
};

const BORDER_COLORS: Record<string, string> = {
  critica: 'border-l-red-500',
  alta: 'border-l-orange-500',
  media: 'border-l-amber-500',
  baixa: 'border-l-emerald-500',
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
  const [residentes, setResidentes] = useState<{ id: string; nome_completo: string }[]>([]);
  const [residenteSearch, setResidenteSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imagens, setImagens] = useState<string[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<IntercorrenciaLog[]>([]);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchResidentes = async () => {
      const { data, error } = await supabase
        .from('residentes')
        .select('id, nome_completo')
        .eq('ativo', true)
        .order('nome_completo');
      
      if (error) {
        console.error('Erro ao buscar residentes:', error);
        return;
      }
      setResidentes((data as any) || []);
    };
    fetchResidentes();
  }, []);

  const residentesFiltrados = residentes.filter(r =>
    r.nome_completo.toLowerCase().includes(residenteSearch.toLowerCase())
  );

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
        imagens,
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
      setResidenteSearch('');
      setImagens([]);
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handleViewLogs = async (intercorrenciaId: string) => {
    const logs = await buscarLogs(intercorrenciaId);
    setSelectedLogs(logs);
    setLogsDialogOpen(true);
  };

  const toggleResidente = (id: string) => {
    setResidenteIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const prioridadeInfo = (p: string) => PRIORIDADES.find(pr => pr.value === p);
  const categoriaInfo = (c: string) => CATEGORIAS.find(cat => cat.value === c);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="bg-background rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/funcionario-access`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Intercorrências</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-7">{funcionarioNome}</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-background rounded-2xl p-4 sm:p-6 shadow-xl">
          <Tabs defaultValue="registrar" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="registrar" className="gap-2">
                <Plus className="w-4 h-4" />
                Registrar
              </TabsTrigger>
              <TabsTrigger value="minhas" className="gap-2">
                <Clock className="w-4 h-4" />
                Minhas ({intercorrencias.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Registrar */}
            <TabsContent value="registrar" className="space-y-4 mt-2">
              {!showForm ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Registrar Nova Intercorrência</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reporte ocorrências para a supervisão de forma rápida e segura.
                    </p>
                  </div>
                  <Button onClick={() => setShowForm(true)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground w-full max-w-xs">
                    <Plus className="w-4 h-4 mr-2" /> Nova Intercorrência
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Título *</Label>
                    <Input
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Resumo breve da ocorrência"
                      maxLength={200}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Descrição detalhada *</Label>
                    <Textarea
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      placeholder="Descreva o que aconteceu, quando, onde e quais ações foram tomadas..."
                      rows={4}
                      maxLength={2000}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{descricao.length}/2000</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Categoria *</Label>
                      <Select value={categoria} onValueChange={setCategoria}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className="flex items-center gap-2">
                                <span>{c.icon}</span> {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Prioridade</Label>
                      <Select value={prioridade} onValueChange={setPrioridade}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORIDADES.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Seleção de Residentes com busca inline */}
                  <div>
                    <Label className="text-sm font-medium">Residentes envolvidos (opcional)</Label>

                    {/* Chips dos selecionados */}
                    {residenteIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                        {residenteIds.map(id => {
                          const r = residentes.find(res => res.id === id);
                          return r ? (
                            <Badge key={id} variant="secondary" className="text-xs py-1 px-2 gap-1">
                              {r.nome_completo}
                              <button
                                type="button"
                                className="hover:text-destructive"
                                onClick={() => toggleResidente(id)}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Campo de busca */}
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={residenteSearch}
                        onChange={e => setResidenteSearch(e.target.value)}
                        placeholder="Buscar residente pelo nome..."
                        className="pl-9"
                      />
                    </div>

                    {/* Lista de residentes */}
                    {(residenteSearch.length > 0 || residenteIds.length === 0) && (
                      <ScrollArea className="max-h-40 mt-2 border rounded-lg">
                        <div className="p-1">
                          {residentes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum residente cadastrado
                            </p>
                          ) : residentesFiltrados.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum residente encontrado para "{residenteSearch}"
                            </p>
                          ) : (
                            residentesFiltrados.map(r => (
                              <label
                                key={r.id}
                                className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <Checkbox
                                  checked={residenteIds.includes(r.id)}
                                  onCheckedChange={() => toggleResidente(r.id)}
                                />
                                <span className="text-sm">{r.nome_completo}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !titulo.trim() || !descricao.trim() || !categoria}
                      className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                      ) : (
                        <><AlertTriangle className="w-4 h-4 mr-2" /> Registrar Intercorrência</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowForm(false); setResidenteSearch(''); }} className="h-12">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab: Minhas Intercorrências */}
            <TabsContent value="minhas" className="space-y-3 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : intercorrencias.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground">Nenhuma intercorrência registrada</p>
                </div>
              ) : (
                intercorrencias.map(item => {
                  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.aberta;
                  const prInfo = prioridadeInfo(item.prioridade);
                  const catInfo = categoriaInfo(item.categoria);
                  const borderClass = BORDER_COLORS[item.prioridade] || 'border-l-gray-300';

                  return (
                    <Card key={item.id} className={`border-l-4 ${borderClass} hover:shadow-md transition-shadow`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-sm flex-1 pr-2">{item.titulo}</h3>
                          <Badge className={`${statusInfo.color} text-xs shrink-0`}>
                            {statusInfo.icon} {statusInfo.label}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.descricao}</p>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {catInfo && (
                            <Badge variant="outline" className="text-xs gap-1">
                              {catInfo.icon} {catInfo.label}
                            </Badge>
                          )}
                          {prInfo && <Badge className={`${prInfo.color} text-xs`}>{prInfo.label}</Badge>}
                        </div>

                        {item.residentes && (
                          <p className="text-xs text-muted-foreground">
                            👤 Residente: <span className="font-medium">{(item.residentes as any).nome_completo}</span>
                          </p>
                        )}

                        {item.prazo_resolucao && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            Prazo: {new Date(item.prazo_resolucao).toLocaleDateString('pt-BR')}
                          </div>
                        )}

                        {item.feedback_gestor && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex items-center gap-1.5 font-semibold text-primary text-xs mb-1">
                              <MessageSquare className="w-3.5 h-3.5" /> Feedback da Gestão
                            </div>
                            <p className="text-xs text-foreground">{item.feedback_gestor}</p>
                            {item.feedback_data && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(item.feedback_data).toLocaleDateString('pt-BR', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleViewLogs(item.id)}>
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
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {selectedLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum registro</p>
                ) : (
                  selectedLogs.map(log => (
                    <div key={log.id} className="border-l-2 border-primary pl-3 py-1.5">
                      <p className="text-sm font-medium">{log.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.usuario_nome} ({log.usuario_tipo === 'funcionario' ? 'Funcionário' : 'Gestor'}) — {new Date(log.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
