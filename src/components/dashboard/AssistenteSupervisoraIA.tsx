import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Send, X, Sparkles, ClipboardList, AlertTriangle,
  Pill, Baby, Users, Trash2, ChevronDown,
} from "lucide-react";
import { useAssistenteSupervisora, MensagemChat } from "@/hooks/useAssistenteSupervisora";
import { cn } from "@/lib/utils";

const ACOES_RAPIDAS = [
  {
    label: "Resumo do dia",
    icon: ClipboardList,
    mensagem: "Me dê um resumo completo do dia de hoje: quem está trabalhando, status dos prontuários, alertas pendentes e estoque.",
  },
  {
    label: "Quem está trabalhando?",
    icon: Users,
    mensagem: "Quais funcionários registraram ponto hoje? Quem ainda não chegou? Alguma ausência inesperada?",
  },
  {
    label: "Prontuários pendentes",
    icon: Sparkles,
    mensagem: "Quais residentes ainda não tiveram o prontuário preenchido hoje? Existem prontuários atrasados de dias anteriores?",
  },
  {
    label: "Alertas e estoques",
    icon: AlertTriangle,
    mensagem: "Quais são os alertas de não conformidade pendentes? Algum estoque de fraldas ou medicamentos em nível crítico?",
  },
  {
    label: "Estoque de fraldas",
    icon: Baby,
    mensagem: "Qual a situação atual do estoque de fraldas? Quais tamanhos estão em baixa? Quantos dias duram os estoques atuais?",
  },
  {
    label: "Medicamentos",
    icon: Pill,
    mensagem: "Quais medicamentos estão com estoque baixo ou perto do vencimento? Algum controlado precisa de atenção?",
  },
];

export default function AssistenteSupervisoraIA() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, enviarMensagem, limparConversa } =
    useAssistenteSupervisora();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    enviarMensagem(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="Abrir assistente da supervisora"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Assistente Supervisão</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-[440px] h-[85vh] sm:h-[620px] flex flex-col bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">Assistente de Supervisão</h3>
            <p className="text-xs opacity-80">Escalas, Prontuários, Estoques e Alertas</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={limparConversa}
              title="Limpar conversa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setIsOpen(false)}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Bot className="w-10 h-10 text-primary mx-auto mb-2 opacity-60" />
              <p className="text-sm text-muted-foreground">
                Olá, supervisora! Posso ajudar com escalas, prontuários, estoques e alertas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACOES_RAPIDAS.map((acao) => (
                <button
                  key={acao.label}
                  onClick={() => enviarMensagem(acao.mensagem)}
                  disabled={isLoading}
                  className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                >
                  <acao.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground">{acao.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs">Consultando dados...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}
      </ScrollArea>

      {/* Ações rápidas inline */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 pb-1 flex gap-1.5 overflow-x-auto">
          {ACOES_RAPIDAS.slice(0, 4).map((acao) => (
            <button
              key={acao.label}
              onClick={() => enviarMensagem(acao.mensagem)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-muted/30 hover:bg-muted/60 transition-colors whitespace-nowrap text-[11px] text-muted-foreground"
            >
              <acao.icon className="w-3 h-3" />
              {acao.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre escalas, prontuários, estoques..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MensagemChat }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Supervisão IA</span>
          </div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
