import { useEffect, useRef, useState } from "react";
import { Bot, Send, ChevronDown, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatLembretes, type MensagemLembrete } from "@/hooks/useChatLembretes";
import { cn } from "@/lib/utils";

const SUGESTOES = [
  "O que falta fazer agora?",
  "Tenho prontuários pendentes?",
  "Próximos medicamentos",
  "Já bati ponto hoje?",
];

interface Props {
  funcionarioId: string;
}

export default function ChatLembretes({ funcionarioId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, error, enviar, limpar } = useChatLembretes(funcionarioId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    enviar(text);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="Abrir Lembrete IA"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Lembrete IA</span>
        <Sparkles className="w-3.5 h-3.5 hidden sm:inline" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-[400px] h-[80vh] sm:h-[560px] flex flex-col bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">Lembrete IA</h3>
            <p className="text-[11px] opacity-80">Seu assistente de rotinas</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={limpar}
              title="Limpar"
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

      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="text-center py-3">
              <Bot className="w-9 h-9 text-primary mx-auto mb-2 opacity-60" />
              <p className="text-sm text-muted-foreground">
                Olá! Posso te ajudar com lembretes de ponto, prontuários e medicamentos.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-left text-xs p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-1.5 items-center text-muted-foreground text-xs py-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:240ms]" />
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {error && (
          <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {error}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte sobre suas rotinas..."
            className="min-h-[38px] max-h-[100px] resize-none text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: MensagemLembrete }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">Lembrete IA</span>
          </div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</div>
      </div>
    </div>
  );
}