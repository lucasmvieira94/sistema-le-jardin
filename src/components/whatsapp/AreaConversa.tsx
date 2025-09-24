import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Bot, User, Clock, CheckCheck, X, Send } from 'lucide-react';
import { ConversaWhatsApp, MensagemWhatsApp } from '@/hooks/useWhatsAppConversas';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AreaConversaProps {
  conversa?: ConversaWhatsApp | null;
  mensagens: MensagemWhatsApp[];
  onEnviarMensagem: (mensagem: string) => Promise<void>;
  onConsultarIA: (pergunta: string) => Promise<void>;
}

export function AreaConversa({ 
  conversa, 
  mensagens, 
  onEnviarMensagem, 
  onConsultarIA 
}: AreaConversaProps) {
  const [novaMensagem, setNovaMensagem] = useState('');
  const [perguntaIA, setPerguntaIA] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [consultandoIA, setConsultandoIA] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || enviando || !conversa) return;

    setEnviando(true);
    try {
      await onEnviarMensagem(novaMensagem.trim());
      setNovaMensagem('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setEnviando(false);
    }
  };

  const handleConsultarIA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perguntaIA.trim() || consultandoIA) return;

    setConsultandoIA(true);
    try {
      await onConsultarIA(perguntaIA.trim());
      setPerguntaIA('');
    } catch (error) {
      console.error('Erro ao consultar IA:', error);
    } finally {
      setConsultandoIA(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'enviada':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'entregue':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'lida':
        return <CheckCheck className="h-3 w-3 text-blue-600" />;
      case 'falhou':
        return <X className="h-3 w-3 text-destructive" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Selecione uma conversa</h3>
          <p className="text-muted-foreground">
            Escolha uma conversa da lista lateral para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header da conversa */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {conversa.nome_contato?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 
               conversa.numero_whatsapp.slice(-2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-semibold">
              {conversa.nome_contato || conversa.numero_whatsapp}
            </h2>
            <p className="text-sm text-muted-foreground">
              {conversa.numero_whatsapp}
            </p>
          </div>
          <Badge variant={conversa.status === 'ativa' ? 'default' : 'secondary'}>
            {conversa.status}
          </Badge>
        </div>
      </div>

      {/* Mensagens */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {mensagens.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p>Nenhuma mensagem ainda</p>
            </div>
          ) : (
            mensagens.map((mensagem) => (
              <div
                key={mensagem.id}
                className={`flex ${mensagem.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-[70%] ${
                  mensagem.direcao === 'enviada' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <CardContent className="p-3">
                    {mensagem.remetente && mensagem.direcao === 'enviada' && (
                      <div className="flex items-center gap-1 mb-1">
                        {mensagem.remetente === 'ia' ? (
                          <Bot className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        <span className="text-xs opacity-75">{mensagem.remetente}</span>
                      </div>
                    )}
                    
                    <p className="text-sm">{mensagem.conteudo}</p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-75">
                        {format(parseISO(mensagem.created_at), 'HH:mm', { locale: ptBR })}
                      </span>
                      {mensagem.direcao === 'enviada' && (
                        <div className="ml-2">
                          {getStatusIcon(mensagem.status)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Área de input */}
      <div className="p-4 space-y-3 bg-card">
        {/* Consulta à IA */}
        <form onSubmit={handleConsultarIA} className="flex gap-2">
          <Input
            placeholder="Consultar IA sobre dados do sistema..."
            value={perguntaIA}
            onChange={(e) => setPerguntaIA(e.target.value)}
            disabled={consultandoIA}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="sm" 
            variant="outline"
            disabled={consultandoIA || !perguntaIA.trim()}
          >
            <Bot className="h-4 w-4" />
            {consultandoIA ? 'Consultando...' : 'IA'}
          </Button>
        </form>

        {/* Envio de mensagem */}
        <form onSubmit={handleEnviarMensagem} className="flex gap-2">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEnviarMensagem(e as any);
              }
            }}
            disabled={enviando}
            className="flex-1 min-h-[40px] max-h-32 resize-none"
            rows={1}
          />
          <Button 
            type="submit" 
            disabled={enviando || !novaMensagem.trim()}
            size="sm"
            className="px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}