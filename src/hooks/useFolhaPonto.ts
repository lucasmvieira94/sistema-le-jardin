
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FolhaPontoData {
  funcionario_nome: string;
  funcionario_cpf: string;
  funcionario_funcao: string;
  funcionario_escala_nome: string;
  funcionario_escala_entrada: string;
  funcionario_escala_saida: string;
  dia: number;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  horas_trabalhadas: string;
  horas_extras_diurnas: string;
  horas_extras_noturnas: string;
  faltas: boolean;
  abonos: boolean;
  observacoes: string | null;
}

export interface TotaisFolhaPonto {
  total_horas_trabalhadas: string;
  total_horas_extras_diurnas: string;
  total_horas_extras_noturnas: string;
  total_faltas: number;
  total_abonos: number;
  dias_trabalhados: number;
}

export function useFolhaPonto(funcionarioId: string, mes: number, ano: number, enabled = false) {
  return useQuery({
    queryKey: ['folha-ponto', funcionarioId, mes, ano],
    queryFn: async () => {
      const { data: folhaData, error: folhaError } = await supabase.rpc(
        'gerar_folha_ponto_mensal',
        {
          p_funcionario_id: funcionarioId,
          p_mes: mes,
          p_ano: ano
        }
      );

      if (folhaError) throw folhaError;

      const { data: totaisData, error: totaisError } = await supabase.rpc(
        'calcular_totais_folha_ponto',
        {
          p_funcionario_id: funcionarioId,
          p_mes: mes,
          p_ano: ano
        }
      );

      if (totaisError) throw totaisError;

      return {
        dados: folhaData as FolhaPontoData[],
        totais: totaisData[0] as TotaisFolhaPonto
      };
    },
    enabled
  });
}
