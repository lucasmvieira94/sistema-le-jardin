import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Settings, BarChart3, Plus, Search, Filter, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppConversas } from '@/hooks/useWhatsAppConversas';
import { ListaConversas } from '@/components/whatsapp/ListaConversas';
import { AreaConversa } from '@/components/whatsapp/AreaConversa';
import { MensagensPredefinidas } from '@/components/whatsapp/MensagensPredefinidas';
import { DashboardMetricas } from '@/components/whatsapp/DashboardMetricas';
import { NovaConversa } from '@/components/whatsapp/NovaConversa';

export default function GerenciamentoWhatsApp() {
  const {
    conversas,
    mensagens,
    mensagensPredefinidas,
    conversaSelecionada,
    loading,
    setConversaSelecionada,
    enviarMensagem,
    consultarIA,
    criarConversa,
    buscarConversas,
    obterMetricas
  } = useWhatsAppConversas();

  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('conversas');
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroBusca, setFiltroBusca] = useState('');

  const handleEnviarMensagem = async (mensagem: string) => {
    if (!conversaSelecionada) return;
    await enviarMensagem(conversaSelecionada.numero_whatsapp, mensagem, conversaSelecionada.id);
  };

  const handleConsultarIA = async (pergunta: string) => {
    await consultarIA(pergunta, conversaSelecionada?.id);
  };

  const handleSelecionarMensagemPredefinida = async (mensagem: string) => {
    if (!conversaSelecionada) return;
    await handleEnviarMensagem(mensagem);
  };

  const handleCriarConversa = async (numeroWhatsApp: string, nomeContato?: string) => {
    await criarConversa(numeroWhatsApp, nomeContato);
  };

  // Filtrar conversas
  const conversasFiltradas = conversas.filter(conversa => {
    const matchStatus = filtroStatus === 'todas' || conversa.status === filtroStatus;
    const matchBusca = !filtroBusca || 
      conversa.nome_contato?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      conversa.numero_whatsapp.includes(filtroBusca);
    return matchStatus && matchBusca;
  });

  return (
    <div className="container mx-auto max-w-7xl py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">WhatsApp & IA</h2>
          <p className="text-muted-foreground">Gerenciamento de conversas e integração com inteligência artificial</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Bell className="w-4 h-4 mr-2" />
            Alertas
          </Button>
          <Button onClick={() => setNovaConversaOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conversa
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="conversas" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="space-y-6">
          {/* Filtros e Busca */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Filtros e Busca</span>
              <Badge variant="outline">{conversasFiltradas.length} de {conversas.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou número..."
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as conversas</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="pausada">Pausadas</SelectItem>
                  <SelectItem value="arquivada">Arquivadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Conversas em formato de tabela */}
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Conversas WhatsApp</h3>
            </div>
            
            <div className="overflow-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Contato</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Última Mensagem</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Atividade</th>
                    <th className="py-3 px-4 text-center text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {conversasFiltradas.map((conversa) => (
                    <tr key={conversa.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{conversa.nome_contato || 'Contato'}</div>
                            <div className="text-sm text-muted-foreground">{conversa.numero_whatsapp}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                        {conversa.ultima_mensagem || 'Sem mensagens'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={conversa.status === 'ativa' ? 'default' : 
                                  conversa.status === 'pausada' ? 'secondary' : 'outline'}
                          className={
                            conversa.status === 'ativa' 
                              ? 'border-green-500 text-green-600 bg-green-50' 
                              : conversa.status === 'pausada'
                              ? 'border-yellow-500 text-yellow-600 bg-yellow-50'
                              : 'border-gray-500 text-gray-600 bg-gray-50'
                          }
                        >
                          {conversa.status === 'ativa' ? 'Ativa' : 
                           conversa.status === 'pausada' ? 'Pausada' : 'Arquivada'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(conversa.ultima_atividade).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConversaSelecionada(conversa)}
                        >
                          Abrir Chat
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {conversasFiltradas.length === 0 && (
                    <tr>
                      <td className="py-8 px-4 text-center text-muted-foreground" colSpan={5}>
                        {conversas.length === 0 
                          ? 'Nenhuma conversa iniciada ainda.' 
                          : 'Nenhuma conversa encontrada com os filtros aplicados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chat Interface */}
          {conversaSelecionada && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <AreaConversa
                  conversa={conversaSelecionada}
                  mensagens={mensagens}
                  onEnviarMensagem={handleEnviarMensagem}
                  onConsultarIA={handleConsultarIA}
                />
              </div>
              <div>
                <MensagensPredefinidas
                  mensagens={mensagensPredefinidas}
                  onSelecionarMensagem={handleSelecionarMensagemPredefinida}
                  loading={loading}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metricas" className="space-y-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Dashboard de Métricas</h3>
            <p className="text-muted-foreground">
              Acompanhe o desempenho das suas conversas WhatsApp e interações com IA
            </p>
          </div>
          
          <DashboardMetricas onObterMetricas={obterMetricas} />
          
          {/* Gráficos adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversas.slice(0, 5).map((conversa) => (
                    <div key={conversa.id} className="flex items-center justify-between p-2 hover:bg-accent/50 rounded">
                      <span className="text-sm font-medium">
                        {conversa.nome_contato || conversa.numero_whatsapp}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conversa.ultima_atividade).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status das Conversas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Ativas</span>
                    <span className="font-medium text-green-600">
                      {conversas.filter(c => c.status === 'ativa').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pausadas</span>
                    <span className="font-medium text-yellow-600">
                      {conversas.filter(c => c.status === 'pausada').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Arquivadas</span>
                    <span className="font-medium text-gray-600">
                      {conversas.filter(c => c.status === 'arquivada').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Configurações e Alertas</h3>
            <p className="text-muted-foreground">
              Gerencie alertas automatizados e configurações avançadas
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alertas Automatizados</CardTitle>
              <CardDescription>
                Esta seção mantém a funcionalidade existente de alertas WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.href = '/notificacoes-whatsapp'}
                className="w-full"
              >
                Acessar Configurações de Alertas
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Nova Conversa */}
      <NovaConversa
        open={novaConversaOpen}
        onOpenChange={setNovaConversaOpen}
        onCriarConversa={handleCriarConversa}
      />
    </div>
  );
}