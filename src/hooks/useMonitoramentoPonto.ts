/**
 * Carrega os dados do ponto e aplica as regras puras de `monitoramentoPonto`.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  analisarPonto,
  agoraParedeBR,
  type AfastamentoMonit,
  type FuncionarioMonit,
  type PendenciaPonto,
} from "@/utils/monitoramentoPonto";

const isoMenosDias = (dias: number) =>
  new Date(agoraParedeBR(new Date()) - dias * 86_400_000).toISOString().slice(0, 10);

export function useMonitoramentoPonto(dias = 7) {
  const [pendencias, setPendencias] = useState<PendenciaPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const inicio = isoMenosDias(dias);
      const hoje = isoMenosDias(0);
      const [y, m] = hoje.split("-").map(Number);
      const mesAnt = m === 1 ? 12 : m - 1;
      const anoAnt = m === 1 ? y - 1 : y;
      const db = supabase as any;

      const [func, regs, afast, just, folhas] = await Promise.all([
        db.from("funcionarios")
          .select("id, nome_completo, data_inicio_vigencia, escalas:escala_id(entrada, saida, jornada_trabalho, intervalo_pre_assinalado, intervalo_minutos)")
          .eq("ativo", true),
        db.from("registros_ponto")
          .select("funcionario_id, data, entrada, saida, intervalo_inicio, intervalo_fim, intervalos_pausas")
          .gte("data", inicio).lte("data", hoje).limit(5000),
        db.from("afastamentos")
          .select("id, funcionario_id, data_inicio, data_fim, tipos_afastamento:tipo_afastamento_id(descricao), afastamentos_anexos(id, revogado_em)")
          .lte("data_inicio", hoje).gte("data_fim", inicio),
        db.from("justificativas_atraso").select("funcionario_id, data").gte("data", inicio),
        db.from("folhas_ponto").select("funcionario_id, mes, ano, confirmado").eq("mes", mesAnt).eq("ano", anoAnt),
      ]);
      const falha = [func, regs, afast, just, folhas].find((r) => r.error);
      if (falha) throw falha.error;

      const funcionarios: FuncionarioMonit[] = (func.data || []).map((f: any) => ({
        id: f.id, nome_completo: f.nome_completo, data_inicio_vigencia: f.data_inicio_vigencia, escala: f.escalas,
      }));
      const afastamentos: AfastamentoMonit[] = (afast.data || []).map((a: any) => ({
        id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_inicio, data_fim: a.data_fim,
        tipo_descricao: a.tipos_afastamento?.descricao,
        possui_anexo: (a.afastamentos_anexos || []).some((x: any) => !x.revogado_em),
      }));

      setPendencias(analisarPonto({
        funcionarios, registros: regs.data || [], afastamentos,
        justificativas: new Set((just.data || []).map((j: any) => `${j.funcionario_id}|${j.data}`)),
        folhas: folhas.data || [], dias,
      }));
    } catch (e: any) {
      console.error("[useMonitoramentoPonto]", e);
      setErro("Não foi possível carregar o monitoramento do ponto.");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);
  return { pendencias, loading, erro, recarregar: carregar };
}
