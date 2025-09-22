import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Bell, Calendar, Clock, Copy, MessageSquare, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { useWhatsAppAlertas } from "@/hooks/useWhatsAppAlertas";
import { AlertaWhatsAppForm } from "@/components/whatsapp/AlertaWhatsAppForm";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NotificacoesWhatsApp() {
  const {
    alertas,
    agendamentos,
    historico,
    loading,
    carregarAlertas,
    carregarAgendamentos,
    carregarHistorico,
    criarAlerta,
    atualizarAlerta,
    duplicarAlerta,
    excluirAlerta,
    reenviarMensagem,
    testarEnvio
  } = useWhatsAppAlertas();

  const [alertaSelecionado, setAlertaSelecionado] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [numeroTeste, setNumeroTeste] = useState("");

  const formatarFrequencia = (tipo: string, valor: number, horario?: string) => {
    switch (tipo) {
      case 'horario_especifico':
        return `Diariamente às ${horario}`;
      case 'horas':
        return `A cada ${valor} hora${valor > 1 ? 's' : ''}`;
      case 'dias':
        return `A cada ${valor} dia${valor > 1 ? 's' : ''}`;
      case 'semanas':
        return `A cada ${valor} semana${valor > 1 ? 's' : ''}`;
      case 'meses':
        return `A cada ${valor} ${valor === 1 ? 'mês' : 'meses'}`;
      default:
        return 'Frequência não definida';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      agendado: { variant: "outline", label: "Agendado" },
      executando: { variant: "secondary", label: "Executando" },
      concluido: { variant: "default", label: "Concluído" },
      erro: { variant: "destructive", label: "Erro" },
      enviado: { variant: "default", label: "Enviado" },
      pendente: { variant: "secondary", label: "Pendente" }
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleSalvarAlerta = async (dados: any) => {
    try {
      if (alertaSelecionado) {
        await atualizarAlerta(alertaSelecionado.id, dados);
      } else {
        await criarAlerta(dados);
      }
      setFormOpen(false);
      setAlertaSelecionado(null);
    } catch (error) {
      console.error('Erro ao salvar alerta:', error);
    }
  };

  const handleDuplicar = async (alerta: any) => {
    try {
      await duplicarAlerta(alerta);
    } catch (error) {
      console.error('Erro ao duplicar alerta:', error);
    }
  };

  const handleExcluir = async (alertaId: string) => {
    if (confirm('Tem certeza que deseja excluir este alerta?')) {
      try {
        await excluirAlerta(alertaId);
      } catch (error) {
        console.error('Erro ao excluir alerta:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Notificações WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie alertas automatizados via WhatsApp
          </p>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setAlertaSelecionado(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Alerta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {alertaSelecionado ? 'Editar Alerta' : 'Novo Alerta WhatsApp'}
              </DialogTitle>
              <DialogDescription>
                Configure um novo alerta para envio automatizado via WhatsApp
              </DialogDescription>
            </DialogHeader>
            <AlertaWhatsAppForm
              alerta={alertaSelecionado}
              onSalvar={handleSalvarAlerta}
              onCancelar={() => {
                setFormOpen(false);
                setAlertaSelecionado(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="alertas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas ({alertas.length})
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos ({agendamentos.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alertas" className="space-y-4">
          {alertas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum alerta configurado</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie seu primeiro alerta WhatsApp para começar a enviar notificações automatizadas
                </p>
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Alerta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {alertas.map((alerta) => (
                <Card key={alerta.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {alerta.nome}
                          {!alerta.ativo && <Badge variant="outline">Inativo</Badge>}
                          {alerta.mensagem_dinamica && <Badge variant="secondary">Dinâmica</Badge>}
                        </CardTitle>
                        <CardDescription>
                          {formatarFrequencia(alerta.frequencia_tipo, alerta.frequencia_valor, alerta.horario_especifico)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAlertaSelecionado(alerta);
                            setFormOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicar(alerta)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExcluir(alerta.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Mensagem:</p>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          {alerta.mensagem}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">
                          Números de destino ({alerta.numeros_destino.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {alerta.numeros_destino.map((numero, index) => (
                            <Badge key={index} variant="outline">
                              {numero}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-muted-foreground">
                          Criado em {format(parseISO(alerta.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const numero = prompt('Digite o número para teste (com código do país):');
                            if (numero) {
                              testarEnvio(alerta.id, numero);
                            }
                          }}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Testar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agendamentos" className="space-y-4">
          {agendamentos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum agendamento ativo</h3>
                <p className="text-muted-foreground text-center">
                  Os agendamentos aparecerão aqui quando você criar alertas ativos
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {agendamentos.map((agendamento) => (
                <Card key={agendamento.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">
                          {agendamento.alertas_whatsapp?.nome || 'Alerta não encontrado'}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Próxima execução: {format(parseISO(agendamento.proxima_execucao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </div>
                        {agendamento.tentativas > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Tentativas: {agendamento.tentativas}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(agendamento.status)}
                        {!agendamento.alertas_whatsapp?.ativo && (
                          <Badge variant="outline">Alerta Inativo</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          {historico.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma notificação enviada</h3>
                <p className="text-muted-foreground text-center">
                  O histórico de notificações aparecerá aqui após os primeiros envios
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {historico.map((notificacao) => (
                <Card key={notificacao.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            {notificacao.alertas_whatsapp?.nome || 'Alerta não encontrado'}
                          </h4>
                          {getStatusBadge(notificacao.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Para: {notificacao.numero_destino}</p>
                          <p>Em: {format(parseISO(notificacao.data_envio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                          {notificacao.tentativa_numero > 1 && (
                            <p>Tentativa: {notificacao.tentativa_numero}</p>
                          )}
                        </div>
                        <div className="bg-muted p-2 rounded text-sm">
                          {notificacao.mensagem_enviada}
                        </div>
                        {notificacao.erro_descricao && (
                          <div className="flex items-start gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{notificacao.erro_descricao}</span>
                          </div>
                        )}
                      </div>
                      {notificacao.status === 'erro' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reenviarMensagem(notificacao.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reenviar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}