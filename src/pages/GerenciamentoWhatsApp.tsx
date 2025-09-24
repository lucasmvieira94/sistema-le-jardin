import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Settings, BarChart3, Plus } from 'lucide-react';
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Gerenciamento WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Conversas, notificações e integração com IA
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setNovaConversaOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Conversa
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-card px-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
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
              Alertas
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 flex">
          <TabsContent value="conversas" className="flex-1 flex m-0">
            {/* Lista lateral de conversas */}
            <ListaConversas
              conversas={conversas}
              conversaSelecionada={conversaSelecionada}
              onSelecionarConversa={setConversaSelecionada}
              onNovaConversa={() => setNovaConversaOpen(true)}
              onBuscar={buscarConversas}
              loading={loading}
            />

            {/* Área central da conversa */}
            <AreaConversa
              conversa={conversaSelecionada}
              mensagens={mensagens}
              onEnviarMensagem={handleEnviarMensagem}
              onConsultarIA={handleConsultarIA}
            />

            {/* Painel lateral de mensagens predefinidas */}
            <MensagensPredefinidas
              mensagens={mensagensPredefinidas}
              onSelecionarMensagem={handleSelecionarMensagemPredefinida}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="metricas" className="flex-1 p-6 m-0">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Dashboard de Métricas</h2>
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
            </div>
          </TabsContent>

          <TabsContent value="configuracoes" className="flex-1 p-6 m-0">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Configurações e Alertas</h2>
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
            </div>
          </TabsContent>
        </div>
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