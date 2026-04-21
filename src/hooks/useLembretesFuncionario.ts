import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Pendencia = {
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  referencia_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type LembretesData = {
  funcionario_nome: string;
  hora: string;
  mensagem_ia: string;
  pendencias: Pendencia[];
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agente-lembretes-funcionario`;

/**
 * Hook que consulta o agente de IA para detectar pendências do funcionário.
 * Faz polling a cada 5 minutos para manter os lembretes atualizados.
 */
export function useLembretesFuncionario(funcionarioId: string | null) {
  const [data, setData] = useState<LembretesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!funcionarioId) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "detectar", funcionario_id: funcionarioId }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as LembretesData;
      setData(json);
    } catch (e) {
      console.error("Erro ao carregar lembretes:", e);
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [funcionarioId]);

  useEffect(() => {
    if (!funcionarioId) return;
    carregar();
    const interval = setInterval(carregar, 5 * 60 * 1000); // a cada 5 min
    return () => clearInterval(interval);
  }, [funcionarioId, carregar]);

  /** Marca um lembrete como dispensado (não aparece mais no dia atual) */
  const dispensarLembrete = useCallback(
    async (pendencia: Pendencia) => {
      if (!funcionarioId) return;
      const hoje = new Date().toISOString().slice(0, 10);
      try {
        await supabase.from("lembretes_funcionario").upsert(
          {
            funcionario_id: funcionarioId,
            tipo_lembrete: pendencia.tipo,
            referencia_id: pendencia.referencia_id ?? "",
            data_referencia: hoje,
            status: "dispensado",
            visualizado_em: new Date().toISOString(),
          },
          { onConflict: "funcionario_id,tipo_lembrete,referencia_id,data_referencia" }
        );
        // Remove localmente
        setData((prev) =>
          prev
            ? {
                ...prev,
                pendencias: prev.pendencias.filter(
                  (p) => !(p.tipo === pendencia.tipo && p.referencia_id === pendencia.referencia_id)
                ),
              }
            : prev
        );
      } catch (e) {
        console.error("Erro ao dispensar lembrete:", e);
      }
    },
    [funcionarioId]
  );

  return { data, isLoading, error, recarregar: carregar, dispensarLembrete };
}