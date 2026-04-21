import { useCallback, useState } from "react";

export interface MensagemLembrete {
  role: "user" | "assistant";
  content: string;
}

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agente-lembretes-funcionario`;

/**
 * Hook do chat conversacional com o agente de lembretes.
 * Faz streaming SSE token-a-token via Lovable AI Gateway.
 */
export function useChatLembretes(funcionarioId: string | null) {
  const [messages, setMessages] = useState<MensagemLembrete[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = useCallback(
    async (input: string) => {
      if (!funcionarioId) return;
      const userMsg: MensagemLembrete = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      let acumulado = "";
      const upsert = (chunk: string) => {
        acumulado += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: acumulado } : m
            );
          }
          return [...prev, { role: "assistant", content: acumulado }];
        });
      };

      try {
        const resp = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "chat",
            funcionario_id: funcionarioId,
            messages: [...messages, userMsg],
          }),
        });

        if (!resp.ok || !resp.body) {
          if (resp.status === 429) {
            setError("Muitas mensagens em pouco tempo. Tente em 1 minuto.");
          } else if (resp.status === 402) {
            setError("Créditos de IA esgotados. Avise a supervisão.");
          } else {
            setError("Não foi possível conectar ao assistente.");
          }
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { done: rdone, value } = await reader.read();
          if (rdone) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsert(content);
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      } catch (e) {
        console.error("Erro chat lembretes:", e);
        setError("Erro ao conversar com o assistente.");
        if (acumulado === "") setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [funcionarioId, messages]
  );

  const limpar = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, enviar, limpar };
}