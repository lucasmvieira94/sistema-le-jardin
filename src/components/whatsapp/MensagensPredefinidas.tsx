import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Search, Send, MessageCircle } from 'lucide-react';
import { MensagemPredefinida } from '@/hooks/useWhatsAppConversas';

interface MensagensPredefinidasProps {
  mensagens: MensagemPredefinida[];
  onSelecionarMensagem: (mensagem: string) => void;
  loading?: boolean;
}

export function MensagensPredefinidas({ 
  mensagens, 
  onSelecionarMensagem, 
  loading = false 
}: MensagensPredefinidasProps) {
  const [termoBusca, setTermoBusca] = useState('');

  const mensagensFiltradas = mensagens.filter(msg =>
    msg.titulo.toLowerCase().includes(termoBusca.toLowerCase()) ||
    msg.conteudo.toLowerCase().includes(termoBusca.toLowerCase()) ||
    msg.categoria.toLowerCase().includes(termoBusca.toLowerCase())
  );

  const categorias = [...new Set(mensagens.map(m => m.categoria))];

  const getCategoriaColor = (categoria: string) => {
    const colors: Record<string, string> = {
      'saudacao': 'bg-blue-100 text-blue-800',
      'agendamento': 'bg-green-100 text-green-800',
      'saude': 'bg-red-100 text-red-800',
      'atendimento': 'bg-yellow-100 text-yellow-800',
      'informacao': 'bg-purple-100 text-purple-800',
      'geral': 'bg-gray-100 text-gray-800'
    };
    return colors[categoria] || colors.geral;
  };

  if (loading) {
    return (
      <div className="w-80 border-l bg-card p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">Mensagens Predefinidas</h3>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mensagens..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {mensagensFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {termoBusca ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem predefinida'}
              </p>
            </div>
          ) : (
            mensagensFiltradas.map((mensagem) => (
              <Card 
                key={mensagem.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium">
                      {mensagem.titulo}
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getCategoriaColor(mensagem.categoria)}`}
                    >
                      {mensagem.categoria}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {mensagem.conteudo}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelecionarMensagem(mensagem.conteudo)}
                    className="w-full"
                  >
                    <Send className="h-3 w-3 mr-2" />
                    Usar Mensagem
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Ações rápidas */}
      <div className="p-4 border-t space-y-2">
        <Separator className="mb-3" />
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSelecionarMensagem('Olá! Como posso ajudá-lo hoje?')}
          >
            Saudação
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSelecionarMensagem('Recebemos sua mensagem e retornaremos em breve.')}
          >
            Recebido
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSelecionarMensagem('Obrigado pelo contato! Estamos sempre aqui para ajudar.')}
          >
            Agradecimento
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSelecionarMensagem('Para mais informações, entre em contato conosco.')}
          >
            Informações
          </Button>
        </div>
      </div>
    </div>
  );
}