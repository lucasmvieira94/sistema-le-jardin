import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Trash2, Sparkles, ClipboardList, AlertTriangle, Pill, Baby, Users, ChevronDown } from 'lucide-react';
import { useAssistenteSupervisorPublico, MensagemChat } from '@/hooks/useAssistenteSupervisorPublico';
import { cn } from '@/lib/utils';

const ACOES_RAPIDAS = [
  { label: 'Resumo do dia', icon: ClipboardList, mensagem: 'Me dê um resumo completo do dia de hoje: quem está trabalhando, status dos prontuários, alertas pendentes e estoque.' },
  { label: 'Quem está trabalhando?', icon: Users, mensagem: 'Quais funcionários registraram ponto hoje? Quem ainda não chegou?' },
  { label: 'Prontuários pendentes', icon: Sparkles, mensagem: 'Quais residentes ainda não tiveram o prontuário preenchido hoje? Existem prontuários atrasados?' },
  { label: 'Alertas e estoques', icon: AlertTriangle, mensagem: 'Quais são os alertas pendentes? Algum estoque crítico?' },
  { label: 'Estoque de fraldas', icon: Baby, mensagem: 'Qual a situação atual do estoque de fraldas? Quais tamanhos estão em baixa?' },
  { label: 'Medicamentos', icon: Pill, mensagem: 'Quais medicamentos estão com estoque baixo ou perto do vencimento?' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AssistenteSupervisorChat({ isOpen, onClose }: Props) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, error, enviarMensagem, limparConversa } = useAssistenteSupervisorPublico();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    enviarMensagem(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:w-[480px] h-[90vh] sm:h-[650px] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <div>
              <h3 className="text-sm font-semibold">Assistente IA</h3>
              <p className="text-xs opacity-80">Supervisão inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={limparConversa} title="Limpar conversa">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={onClose}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Bot className="w-10 h-10 text-indigo-500 mx-auto mb-2 opacity-60" />
                <p className="text-sm text-gray-500">Olá! Posso ajudar com escalas, prontuários, estoques e alertas.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ACOES_RAPIDAS.map((acao) => (
                  <button key={acao.label} onClick={() => enviarMensagem(acao.mensagem)} disabled={isLoading}
                    className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50 hover:bg-indigo-50 transition-colors text-left disabled:opacity-50">
                    <acao.icon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700">{acao.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs">Consultando dados...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
          )}
        </ScrollArea>

        {/* Quick actions inline */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto">
            {ACOES_RAPIDAS.slice(0, 4).map((acao) => (
              <button key={acao.label} onClick={() => enviarMensagem(acao.mensagem)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border bg-gray-50 hover:bg-indigo-50 transition-colors whitespace-nowrap text-[11px] text-gray-500">
                <acao.icon className="w-3 h-3" />
                {acao.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t bg-white">
          <div className="flex items-end gap-2">
            <Textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre escalas, prontuários, estoques..." className="min-h-[40px] max-h-[100px] resize-none text-sm" rows={1} disabled={isLoading} />
            <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="h-10 w-10 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MensagemChat }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
        isUser ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md')}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-indigo-600">Supervisão IA</span>
          </div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</div>
      </div>
    </div>
  );
}
