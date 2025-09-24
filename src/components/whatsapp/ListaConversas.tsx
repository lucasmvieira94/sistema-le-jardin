import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { ConversaWhatsApp } from '@/hooks/useWhatsAppConversas';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ListaConversasProps {
  conversas: ConversaWhatsApp[];
  conversaSelecionada?: ConversaWhatsApp | null;
  onSelecionarConversa: (conversa: ConversaWhatsApp) => void;
  onNovaConversa: () => void;
  onBuscar: (termo: string) => void;
  loading?: boolean;
}

export function ListaConversas({
  conversas,
  conversaSelecionada,
  onSelecionarConversa,
  onNovaConversa,
  onBuscar,
  loading = false
}: ListaConversasProps) {
  const [termoBusca, setTermoBusca] = useState('');

  const handleBuscar = (valor: string) => {
    setTermoBusca(valor);
    onBuscar(valor);
  };

  const formatarUltimaAtividade = (data: string) => {
    try {
      const dataObj = parseISO(data);
      const agora = new Date();
      const diffHoras = Math.abs(agora.getTime() - dataObj.getTime()) / (1000 * 60 * 60);
      
      if (diffHoras < 1) {
        return 'Agora há pouco';
      } else if (diffHoras < 24) {
        return format(dataObj, 'HH:mm');
      } else {
        return format(dataObj, 'dd/MM', { locale: ptBR });
      }
    } catch {
      return 'Agora';
    }
  };

  const getInitials = (nome?: string, numero?: string) => {
    if (nome && nome !== numero) {
      return nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return numero?.slice(-2) || '?';
  };

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversas WhatsApp</h2>
          <Button size="sm" onClick={onNovaConversa}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={termoBusca}
            onChange={(e) => handleBuscar(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de conversas */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <MessageSquare className="h-8 w-8 animate-pulse text-muted-foreground" />
            </div>
          ) : conversas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {termoBusca ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ativa'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversas.map((conversa) => (
                <Card
                  key={conversa.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    conversaSelecionada?.id === conversa.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSelecionarConversa(conversa)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs">
                          {getInitials(conversa.nome_contato, conversa.numero_whatsapp)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm truncate">
                            {conversa.nome_contato || conversa.numero_whatsapp}
                          </h3>
                          <div className="flex items-center gap-1">
                            {conversa.mensagens_nao_lidas > 0 && (
                              <Badge variant="destructive" className="text-xs px-2 py-0">
                                {conversa.mensagens_nao_lidas}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatarUltimaAtividade(conversa.ultima_atividade)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {conversa.numero_whatsapp}
                        </p>
                        
                        {conversa.ultima_mensagem && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {conversa.ultima_mensagem}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}