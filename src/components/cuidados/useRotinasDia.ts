import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { diaAnterior, ocorrenciasDoDia, orientacoesVigentes, type ExecucaoRotina, type RotinaCuidado } from "@/utils/rotinasCuidados";

/** Rotinas vigentes + registros de hoje, recalculando o status a cada minuto. */
export function useRotinasDia(residenteId?: string) {
  const [rotinas, setRotinas] = useState<RotinaCuidado[] | null>(null);
  const [execucoes, setExecucoes] = useState<ExecucaoRotina[]>([]);
  const [agora, setAgora] = useState(new Date());
  const dia = formatInTimeZone(agora, "America/Sao_Paulo", "yyyy-MM-dd");
  const carregar = useCallback(async () => {
    const [r, e] = await Promise.all([
      supabase.rpc("portal_rotinas_listar" as any, { _residente_id: residenteId ?? null, _incluir_encerradas: false }),
      supabase.rpc("portal_rotinas_execucoes" as any, { _inicio: diaAnterior(dia), _fim: dia, _residente_id: residenteId ?? null }),
    ]);
    setRotinas((r.data as RotinaCuidado[]) ?? []); setExecucoes((e.data as ExecucaoRotina[]) ?? []);
  }, [residenteId, dia]);
  useEffect(() => { carregar(); const t = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(t); }, [carregar]);
  const [h, m] = formatInTimeZone(agora, "America/Sao_Paulo", "HH:mm").split(":").map(Number);
  const ocorrencias = useMemo(() => ocorrenciasDoDia(rotinas ?? [], execucoes, dia, h * 60 + m), [rotinas, execucoes, dia, h, m]);
  const orientacoes = useMemo(() => orientacoesVigentes(rotinas ?? [], dia), [rotinas, dia]);
  return { rotinas, ocorrencias, orientacoes, carregar };
}
