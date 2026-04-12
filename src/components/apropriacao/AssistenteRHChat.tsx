
import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES_RAPIDAS = [
  "Resumo dos registros de ponto da semana",
  "Quais funcionários têm horas extras pendentes?",
  "Como calcular adicional noturno?",
  "Quais funcionários faltaram esta semana?",
  "Regras de intervalo intrajornada",
];

export default function AssistenteRHChat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const enviarMensagem = async (texto?: string) => {
    const mensagemTexto = texto || input.trim();
    if (!mensagemTexto || carregando) return;

    const novaMensagem: Mensagem = { role: "user", content: mensagemTexto };
    const historicoAtualizado = [...mensagens, novaMensagem];
    setMensagens(historicoAtualizado);
    setInput("");
    setCarregando(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-rh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: historicoAtualizado.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        throw new Error(`Erro ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMensagens((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: assistantSoFar }
                      : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("Erro no assistente RH:", e);
      setMensagens((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, houve um erro ao processar sua mensagem. Tente novamente.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg flex flex-col h-[calc(100vh-12rem)] sticky top-24">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Assistente de RH</h3>
              <p className="text-xs text-muted-foreground">IA para rotinas de RH</p>
            </div>
          </div>
          {mensagens.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMensagens([])}
              className="h-7 px-2"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {mensagens.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Como posso ajudar com as rotinas de RH?
            </p>
            <div className="space-y-2">
              {SUGESTOES_RAPIDAS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => enviarMensagem(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg border hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {mensagens.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {carregando && mensagens[mensagens.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre rotinas de RH..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="sm"
            onClick={() => enviarMensagem()}
            disabled={!input.trim() || carregando}
            className="h-10 w-10 p-0 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
