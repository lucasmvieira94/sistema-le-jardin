import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContaPagarStatus = "pendente" | "pago" | "atrasado" | "cancelado";
export type ContaPagarCategoria =
  | "fornecedor" | "folha_pagamento" | "agua" | "luz" | "internet"
  | "aluguel" | "manutencao" | "alimentacao" | "medicamentos"
  | "impostos" | "servicos" | "outros";
export type FrequenciaRecorrencia =
  | "semanal" | "quinzenal" | "mensal" | "bimestral"
  | "trimestral" | "semestral" | "anual";

export type ContaPagar = {
  id: string;
  tenant_id: string | null;
  descricao: string;
  categoria: ContaPagarCategoria;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaPagarStatus;
  forma_pagamento: string | null;
  recorrente: boolean;
  frequencia_recorrencia: FrequenciaRecorrencia | null;
  observacoes: string | null;
  anexo_url: string | null;
  criado_por: string | null;
  origem_recorrencia: string | null;
  created_at: string;
  updated_at: string;
};

export const CATEGORIAS: { value: ContaPagarCategoria; label: string }[] = [
  { value: "fornecedor", label: "Fornecedor" },
  { value: "folha_pagamento", label: "Folha de pagamento" },
  { value: "agua", label: "Água" },
  { value: "luz", label: "Luz / Energia" },
  { value: "internet", label: "Internet / Telefonia" },
  { value: "aluguel", label: "Aluguel" },
  { value: "manutencao", label: "Manutenção" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "medicamentos", label: "Medicamentos" },
  { value: "impostos", label: "Impostos / Taxas" },
  { value: "servicos", label: "Serviços" },
  { value: "outros", label: "Outros" },
];

export const FREQUENCIAS: { value: FrequenciaRecorrencia; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export function useContasPagar(filtros?: {
  inicio?: string; fim?: string; status?: ContaPagarStatus | "todos"; categoria?: ContaPagarCategoria | "todas";
}) {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    // marca atrasadas antes
    await (supabase as any).rpc("marcar_contas_atrasadas").catch(() => {});
    let q = (supabase as any).from("contas_pagar").select("*").order("data_vencimento", { ascending: true });
    if (filtros?.inicio) q = q.gte("data_vencimento", filtros.inicio);
    if (filtros?.fim) q = q.lte("data_vencimento", filtros.fim);
    if (filtros?.status && filtros.status !== "todos") q = q.eq("status", filtros.status);
    if (filtros?.categoria && filtros.categoria !== "todas") q = q.eq("categoria", filtros.categoria);
    const { data, error } = await q;
    if (!error) setContas((data as ContaPagar[]) ?? []);
    setLoading(false);
  }, [filtros?.inicio, filtros?.fim, filtros?.status, filtros?.categoria]);

  useEffect(() => { carregar(); }, [carregar]);

  return { contas, loading, recarregar: carregar };
}
