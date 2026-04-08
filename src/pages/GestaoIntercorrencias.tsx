import { useState } from 'react';
import { formatarData, formatarDataHora } from '@/utils/dateUtils';
import { AlertTriangle, Clock, MessageSquare, CheckCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIntercorrencias, Intercorrencia, IntercorrenciaLog } from '@/hooks/useIntercorrencias';
import { useAuthSession } from '@/hooks/useAuthSession';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800' },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-800' },
  resolvida: { label: 'Resolvida', color: 'bg-green-100 text-green-800' },
  encerrada: { label: 'Encerrada', color: 'bg-gray-100 text-gray-800' },
};

const PRIORIDADES: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-800' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-800' },
};

const CATEGORIAS: Record<string, string> = {
  saude_residente: 'Saúde do Residente',
  infraestrutura: 'Infraestrutura',
  comportamental: 'Comportamental',
  medicacao: 'Medicação',
};

export default function GestaoIntercorrencias() {
  const { user } = useAuthSession();
  const { intercorrencias, loading, atualizarStatus, definirPrazo, enviarFeedback, buscarLogs } = useIntercorrencias();

  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas');
  const [selectedItem, setSelectedItem] = useState<Intercorrencia | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logs, setLogs] = useState<IntercorrenciaLog[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [prazoDate, setPrazoDate] = useState('');
  const [novoStatus, setNovoStatus] = useState('');

  const filtered = intercorrencias.filter(i => {
    if (filtroStatus !== 'todas' && i.status !== filtroStatus) return false;
    if (filtroPrioridade !== 'todas' && i.prioridade !== filtroPrioridade) return false;
    return true;
  });

  const counts = {
    total: intercorrencias.length,
    abertas: intercorrencias.filter(i => i.status === 'aberta').length,
    criticas: intercorrencias.filter(i => i.prioridade === 'critica' && i.status !== 'resolvida' && i.status !== 'encerrada').length,
    resolvidas: intercorrencias.filter(i => i.status === 'resolvida' || i.status === 'encerrada').length,
  };

  const openDetails = async (item: Intercorrencia) => {
    setSelectedItem(item);
    setNovoStatus(item.status);
    setFeedbackText(item.feedback_gestor || '');
    setPrazoDate(item.prazo_resolucao ? item.prazo_resolucao.split('T')[0] : '');
    const logsList = await buscarLogs(item.id);
    setLogs(logsList);
    setDetailsOpen(true);
  };

  const usuarioNome = user?.email || 'Administrador';

  const handleSaveStatus = async () => {
    if (!selectedItem || novoStatus === selectedItem.status) return;
    await atualizarStatus(selectedItem.id, novoStatus, usuarioNome, 'gestor');
    setDetailsOpen(false);
  };

  const handleSavePrazo = async () => {
    if (!selectedItem || !prazoDate) return;
    await definirPrazo(selectedItem.id, new Date(prazoDate).toISOString(), usuarioNome, 'gestor');
    setDetailsOpen(false);
  };

  const handleSaveFeedback = async () => {
    if (!selectedItem || !feedbackText.trim()) return;
    await enviarFeedback(selectedItem.id, feedbackText.trim(), selectedItem.funcionario_id, usuarioNome, 'gestor');
    setDetailsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Intercorrências</h1>
        <p className="text-muted-foreground">Gerencie e acompanhe todas as intercorrências registradas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{counts.total}</p>
            <p className="text-sm text-blue-600">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-700">{counts.abertas}</p>
            <p className="text-sm text-yellow-600">Abertas</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{counts.criticas}</p>
            <p className="text-sm text-red-600">Críticas Pendentes</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{counts.resolvidas}</p>
            <p className="text-sm text-green-600">Resolvidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos Status</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Prioridades</SelectItem>
            {Object.entries(PRIORIDADES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma intercorrência encontrada</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.aberta;
            const prInfo = PRIORIDADES[item.prioridade];
            const isOverdue = item.prazo_resolucao && new Date(item.prazo_resolucao) < new Date() && item.status !== 'resolvida' && item.status !== 'encerrada';
            return (
              <Card key={item.id} className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300 bg-red-50/50' : ''}`} onClick={() => openDetails(item)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.titulo}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Por: {(item.funcionarios as any)?.nome_completo || 'N/A'}
                        {item.residentes && ` | Residente: ${(item.residentes as any).nome}`}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      {prInfo && <Badge className={prInfo.color}>{prInfo.label}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.descricao}</p>
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{CATEGORIAS[item.categoria]}</span>
                      {item.prazo_resolucao && (
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                          <Clock className="w-3 h-3" />
                          {isOverdue ? 'ATRASADA — ' : ''}Prazo: {formatarData(item.prazo_resolucao)}
                        </span>
                      )}
                      {item.feedback_gestor && <MessageSquare className="w-3 h-3 text-blue-500" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatarData(item.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.titulo}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <p className="text-sm">{selectedItem.descricao}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{CATEGORIAS[selectedItem.categoria]}</Badge>
                  <Badge className={PRIORIDADES[selectedItem.prioridade]?.color}>{PRIORIDADES[selectedItem.prioridade]?.label}</Badge>
                  <Badge className={STATUS_MAP[selectedItem.status]?.color}>{STATUS_MAP[selectedItem.status]?.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Registrada por: {(selectedItem.funcionarios as any)?.nome_completo} em {formatarDataHora(selectedItem.created_at)}
                </p>
              </div>

              <Tabs defaultValue="acoes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="acoes">Ações</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="acoes" className="space-y-4 mt-3">
                  <div>
                    <Label>Alterar Status</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={novoStatus} onValueChange={setNovoStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_MAP).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleSaveStatus} disabled={novoStatus === selectedItem.status}>Salvar</Button>
                    </div>
                  </div>
                  <div>
                    <Label>Prazo para Resolução</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type="date" value={prazoDate} onChange={e => setPrazoDate(e.target.value)} />
                      <Button size="sm" onClick={handleSavePrazo} disabled={!prazoDate}>Definir</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="feedback" className="space-y-3 mt-3">
                  <div>
                    <Label>Feedback para o Funcionário</Label>
                    <Textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Escreva o feedback..." rows={4} maxLength={2000} />
                  </div>
                  <Button onClick={handleSaveFeedback} disabled={!feedbackText.trim()} className="w-full">
                    <MessageSquare className="w-4 h-4 mr-2" /> Enviar Feedback
                  </Button>
                </TabsContent>

                <TabsContent value="historico" className="mt-3">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {logs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">Nenhum registro</p>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className="border-l-2 border-primary pl-3 py-1">
                          <p className="text-sm">{log.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.usuario_nome} ({log.usuario_tipo === 'funcionario' ? 'Funcionário' : 'Gestor'}) — {formatarDataHora(log.created_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
