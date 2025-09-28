
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
      if (!funcionarioId) {
        throw new Error('ID do funcionário é obrigatório');
      }

      console.log('useFolhaPonto - chamando RPCs com:', { funcionarioId, mes, ano });
      
      const { data: folhaData, error: folhaError } = await supabase.rpc(
        'gerar_folha_ponto_mensal',
        {
          p_funcionario_id: funcionarioId,
          p_mes: mes,
          p_ano: ano
        }
      );

      if (folhaError) {
        console.error('Erro ao buscar dados da folha de ponto:', folhaError);
        throw folhaError;
      }

      const { data: totaisData, error: totaisError } = await supabase.rpc(
        'calcular_totais_folha_ponto',
        {
          p_funcionario_id: funcionarioId,
          p_mes: mes,
          p_ano: ano
        }
      );

      if (totaisError) {
        console.error('Erro ao calcular totais:', totaisError);
        throw totaisError;
      }

      const result = {
        dados: (folhaData || []) as FolhaPontoData[],
        totais: (totaisData && totaisData[0]) ? totaisData[0] as TotaisFolhaPonto : {
          total_horas_trabalhadas: '00:00:00',
          total_horas_extras_diurnas: '00:00:00',
          total_horas_extras_noturnas: '00:00:00',
          total_faltas: 0,
          total_abonos: 0,
          dias_trabalhados: 0
        }
      };
      
      console.log('useFolhaPonto - result final:', result);
      
      return result;
    },
    enabled: enabled && !!funcionarioId
  });
}
