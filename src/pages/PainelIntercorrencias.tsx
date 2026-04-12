import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, AlertTriangle, CheckCircle, Filter, Eye, Baby, Pill, FileText, Bot, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useIntercorrencias, Intercorrencia, IntercorrenciaLog } from '@/hooks/useIntercorrencias';
import { useSupervisorDashboardData } from '@/hooks/useSupervisorDashboardData';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';
import AssistenteSupervisorChat from '@/components/supervisor/AssistenteSupervisorChat';

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵' },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🟠' },
  resolvida: { label: 'Resolvida', color: 'bg-green-100 text-green-800 border-green-200', icon: '🟢' },
  encerrada: { label: 'Encerrada', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '⚪' },
};

const PRIORIDADES: Record<string, { label: string; color: string; border: string }> = {
  baixa: { label: 'Baixa', color: 'bg-emerald-100 text-emerald-800', border: 'border-l-emerald-400' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800', border: 'border-l-yellow-400' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800', border: 'border-l-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-800', border: 'border-l-red-500' },
};

const CATEGORIAS: Record<string, string> = {
  saude_residente: '🏥 Saúde do Residente',
  infraestrutura: '🏗️ Infraestrutura',
  comportamental: '👤 Comportamental',
  medicacao: '💊 Medicação',
};

export default function PainelIntercorrencias() {
  useFuncionarioSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = searchParams.get('funcionario_id') || '';
  const funcionarioNome = decodeURIComponent(searchParams.get('funcionario_nome') || '');

  const { intercorrencias, loading: loadingInter, atualizarStatus, definirPrazo, enviarFeedback, buscarLogs } = useIntercorrencias();
  const { data: dashData, loading: loadingDash, refetch } = useSupervisorDashboardData();

  const [activeTab, setActiveTab] = useState('visao-geral');
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [selectedItem, setSelectedItem] = useState<Intercorrencia | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logs, setLogs] = useState<IntercorrenciaLog[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [prazoDate, setPrazoDate] = useState('');
  const [novoStatus, setNovoStatus] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

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

  const handleSaveStatus = async () => {
    if (!selectedItem || novoStatus === selectedItem.status) return;
    await atualizarStatus(selectedItem.id, novoStatus, funcionarioNome, 'supervisor');
    setDetailsOpen(false);
  };

  const handleSavePrazo = async () => {
    if (!selectedItem || !prazoDate) return;
    await definirPrazo(selectedItem.id, new Date(prazoDate).toISOString(), funcionarioNome, 'supervisor');
    setDetailsOpen(false);
  };

  const handleSaveFeedback = async () => {
    if (!selectedItem || !feedbackText.trim()) return;
    await enviarFeedback(selectedItem.id, feedbackText.trim(), funcionarioId, funcionarioNome, 'supervisor');
    setDetailsOpen(false);
  };

  const prontuarioPerc = dashData.prontuarios.totalResidentes > 0
    ? Math.round((dashData.prontuarios.encerrados / dashData.prontuarios.totalResidentes) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-indigo-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/?funcionario_id=${funcionarioId}`)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                  Dashboard do Supervisor
                </h1>
                <p className="text-sm text-gray-500">{funcionarioNome}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refetch} className="hidden sm:flex">
                <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
              </Button>
              <Button size="sm" onClick={() => setChatOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Bot className="w-4 h-4 mr-1" /> Assistente IA
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="bg-white rounded-xl p-1 shadow">
            <TabsList className="w-full grid grid-cols-2 h-auto">
              <TabsTrigger value="visao-geral" className="py-2.5 text-sm">
                <LayoutDashboard className="w-4 h-4 mr-1.5" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="intercorrencias" className="py-2.5 text-sm">
                <AlertTriangle className="w-4 h-4 mr-1.5" /> Intercorrências
                {counts.abertas > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{counts.abertas}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== VISÃO GERAL ==================== */}
          <TabsContent value="visao-geral" className="space-y-4">
            {loadingDash ? (
              <div className="text-center text-white py-12">Carregando dados...</div>
            ) : (
              <>
                {/* KPIs principais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KPICard icon={<FileText className="w-5 h-5 text-indigo-500" />} label="Prontuários Hoje" value={`${dashData.prontuarios.encerrados}/${dashData.prontuarios.totalResidentes}`} sub={`${prontuarioPerc}% completos`}
                    color={prontuarioPerc >= 80 ? 'border-green-200 bg-green-50' : prontuarioPerc >= 50 ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'} />
                  <KPICard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Intercorrências" value={String(counts.abertas)} sub={`${counts.criticas} críticas`}
                    color={counts.criticas > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'} />
                  <KPICard icon={<Baby className="w-5 h-5 text-purple-500" />} label="Fraldas em Alerta" value={String(dashData.fraldasEstoque.alertas)} sub={`${dashData.fraldasEstoque.criticos} críticos`}
                    color={dashData.fraldasEstoque.criticos > 0 ? 'border-red-200 bg-red-50' : dashData.fraldasEstoque.alertas > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'} />
                  <KPICard icon={<Pill className="w-5 h-5 text-blue-500" />} label="Medicamentos" value={String(dashData.medicamentosEstoque.alertas)} sub={`${dashData.medicamentosEstoque.vencendo} vencendo`}
                    color={dashData.medicamentosEstoque.alertas > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'} />
                </div>

                {/* Prontuários */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" /> Prontuários do Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <Progress value={prontuarioPerc} className="flex-1 h-3" />
                      <span className="text-sm font-semibold text-gray-700">{prontuarioPerc}%</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-700">{dashData.prontuarios.encerrados}</p>
                        <p className="text-[11px] text-green-600">Encerrados</p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-yellow-700">{dashData.prontuarios.pendentes}</p>
                        <p className="text-[11px] text-yellow-600">Pendentes</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-red-700">{dashData.prontuarios.atrasados}</p>
                        <p className="text-[11px] text-red-600">Atrasados</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-700">{dashData.prontuarios.totalResidentes}</p>
                        <p className="text-[11px] text-blue-600">Total Residentes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Fraldas e Medicamentos lado a lado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fraldas */}
                  <Card className="shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Baby className="w-4 h-4 text-purple-500" /> Estoque de Fraldas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashData.fraldasEstoque.items.length === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Todos os estoques OK</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {dashData.fraldasEstoque.items.map((f: any, i: number) => (
                            <div key={i} className={`p-2 rounded-lg border text-sm ${f.dias_restantes !== null && f.dias_restantes <= 3 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-800">{f.tipo_fralda} {f.tamanho}</span>
                                <Badge variant="outline" className="text-[10px]">{f.quantidade_atual}/{f.quantidade_minima}</Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {f.residente_nome}
                                {f.dias_restantes !== null && ` • ~${f.dias_restantes} dias`}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Medicamentos */}
                  <Card className="shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pill className="w-4 h-4 text-blue-500" /> Estoque de Medicamentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashData.medicamentosEstoque.items.length === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Todos os estoques OK</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {dashData.medicamentosEstoque.items.map((m: any, i: number) => (
                            <div key={i} className={`p-2 rounded-lg border text-sm ${m.controlado ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-800">
                                  {m.nome} {m.controlado && <span className="text-red-600 text-[10px]">⚠️ CONTROLADO</span>}
                                </span>
                                <Badge variant="outline" className="text-[10px]">{m.quantidade_atual}/{m.quantidade_minima}</Badge>
                              </div>
                              {m.data_validade && (
                                <p className="text-xs text-gray-500">Validade: {new Date(m.data_validade).toLocaleDateString('pt-BR')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Intercorrências recentes */}
                <Card className="shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" /> Intercorrências Recentes
                      </span>
                      <Button variant="link" size="sm" className="text-indigo-600" onClick={() => setActiveTab('intercorrencias')}>
                        Ver todas →
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {intercorrencias.filter(i => i.status !== 'encerrada' && i.status !== 'resolvida').length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhuma intercorrência em aberto</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {intercorrencias.filter(i => i.status !== 'encerrada' && i.status !== 'resolvida').slice(0, 5).map(item => {
                          const prInfo = PRIORIDADES[item.prioridade];
                          return (
                            <div key={item.id} className={`p-2.5 rounded-lg border-l-4 cursor-pointer hover:bg-gray-50 transition-colors ${prInfo?.border || ''}`}
                              onClick={() => { setActiveTab('intercorrencias'); openDetails(item); }}>
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-sm text-gray-800">{item.titulo}</span>
                                <Badge className={`text-[10px] ${STATUS_MAP[item.status]?.color}`}>{STATUS_MAP[item.status]?.label}</Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.descricao}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ==================== INTERCORRÊNCIAS ==================== */}
          <TabsContent value="intercorrencias" className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard icon={<Eye className="w-5 h-5 text-blue-500" />} label="Total" value={String(counts.total)} color="border-blue-200 bg-blue-50" />
              <KPICard icon={<Clock className="w-5 h-5 text-yellow-500" />} label="Abertas" value={String(counts.abertas)} color="border-yellow-200 bg-yellow-50" />
              <KPICard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Críticas" value={String(counts.criticas)} color="border-red-200 bg-red-50" />
              <KPICard icon={<CheckCircle className="w-5 h-5 text-green-500" />} label="Resolvidas" value={String(counts.resolvidas)} color="border-green-200 bg-green-50" />
            </div>

            {/* Filtros */}
            <Card className="shadow">
              <CardContent className="p-3 flex flex-wrap gap-3">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-40"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos Status</SelectItem>
                    {Object.entries(STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas Prioridades</SelectItem>
                    {Object.entries(PRIORIDADES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Lista */}
            {loadingInter ? (
              <p className="text-center text-white py-8">Carregando...</p>
            ) : filtered.length === 0 ? (
              <Card className="shadow"><CardContent className="p-8 text-center text-gray-400">Nenhuma intercorrência encontrada</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(item => {
                  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.aberta;
                  const prInfo = PRIORIDADES[item.prioridade];
                  const isOverdue = item.prazo_resolucao && new Date(item.prazo_resolucao) < new Date() && item.status !== 'resolvida' && item.status !== 'encerrada';
                  return (
                    <Card key={item.id} className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${prInfo?.border || ''} ${isOverdue ? 'ring-2 ring-red-300' : ''}`}
                      onClick={() => openDetails(item)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900">{item.titulo}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Por: {(item.funcionarios as any)?.nome_completo || 'N/A'}
                              {item.residentes && ` • Residente: ${(item.residentes as any)?.nome_completo || 'N/A'}`}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <Badge className={`text-[10px] ${statusInfo.color}`}>{statusInfo.icon} {statusInfo.label}</Badge>
                            {prInfo && <Badge className={`text-[10px] ${prInfo.color}`}>{prInfo.label}</Badge>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{item.descricao}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">{CATEGORIAS[item.categoria] || item.categoria}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {isOverdue && <span className="text-red-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> ATRASADA</span>}
                            {item.prazo_resolucao && !isOverdue && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(item.prazo_resolucao).toLocaleDateString('pt-BR')}</span>
                            )}
                            <span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* FAB para assistente IA */}
        {!chatOpen && (
          <button onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Assistente IA</span>
          </button>
        )}

        {/* Chat IA */}
        <AssistenteSupervisorChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

        {/* Dialog Detalhes */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{selectedItem?.titulo}</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-700">{selectedItem.descricao}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{CATEGORIAS[selectedItem.categoria] || selectedItem.categoria}</Badge>
                    <Badge className={PRIORIDADES[selectedItem.prioridade]?.color}>{PRIORIDADES[selectedItem.prioridade]?.label}</Badge>
                    <Badge className={STATUS_MAP[selectedItem.status]?.color}>{STATUS_MAP[selectedItem.status]?.icon} {STATUS_MAP[selectedItem.status]?.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Registrada por: {(selectedItem.funcionarios as any)?.nome_completo}
                    {selectedItem.residentes && ` • Residente: ${(selectedItem.residentes as any)?.nome_completo || 'N/A'}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(selectedItem.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                              <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
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
                      <p className="text-xs text-gray-400 text-right mt-1">{feedbackText.length}/2000</p>
                    </div>
                    <Button onClick={handleSaveFeedback} disabled={!feedbackText.trim()} className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" /> Enviar Feedback
                    </Button>
                  </TabsContent>

                  <TabsContent value="historico" className="mt-3">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {logs.length === 0 ? (
                        <p className="text-center text-gray-400 py-4 text-sm">Nenhum registro</p>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className="border-l-2 border-indigo-400 pl-3 py-1">
                            <p className="text-sm text-gray-700">{log.descricao}</p>
                            <p className="text-xs text-gray-400">
                              {log.usuario_nome} — {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}

function KPICard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className={`border ${color} shadow`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}
