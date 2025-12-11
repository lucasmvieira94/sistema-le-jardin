import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";

export interface EstoqueFralda {
  id: string;
  tipo_fralda: string;
  tamanho: string;
  marca?: string;
  quantidade_atual: number;
  quantidade_minima: number;
  unidade_medida: string;
  localizacao?: string;
  fornecedor?: string;
  preco_unitario?: number;
  data_ultima_compra?: string;
  observacoes?: string;
  ativo: boolean;
  consumo_medio_diario: number;
  residente_id?: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface UsoFralda {
  id: string;
  estoque_fralda_id: string;
  residente_id: string;
  funcionario_id: string;
  data_uso: string;
  horario_uso: string;
  quantidade_usada: number;
  tipo_troca?: string;
  observacoes?: string;
  created_at: string;
}

export interface ConfiguracaoAlertasFraldas {
  id: string;
  tenant_id: string;
  dias_alerta_critico: number;
  dias_alerta_aviso: number;
  dias_alerta_atencao: number;
  notificar_email: boolean;
  notificar_dashboard: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertaEstoqueFralda {
  estoque_id: string;
  tipo_fralda: string;
  tamanho: string;
  quantidade_atual: number;
  consumo_medio_diario: number;
  dias_restantes: number;
  nivel_alerta: 'critico' | 'aviso' | 'atencao' | 'normal';
  localizacao?: string;
}

export const useFraldas = () => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Buscar estoque de fraldas filtrado por tenant
  const { data: estoques, isLoading: loadingEstoques } = useQuery({
    queryKey: ["estoque-fraldas", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("estoque_fraldas")
        .select("*")
        .eq("ativo", true)
        .eq("tenant_id", tenantId)
        .order("tipo_fralda", { ascending: true });

      if (error) throw error;
      return data as EstoqueFralda[];
    },
    enabled: !!tenantId,
  });

  // Buscar alertas de estoque filtrado por tenant
  const { data: alertas, isLoading: loadingAlertas } = useQuery({
    queryKey: ["alertas-estoque-fraldas", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase.rpc("obter_alertas_estoque_fraldas");

      if (error) throw error;
      
      // Filtrar alertas pelo tenant atual (a função RPC pode retornar de todos os tenants)
      // Os IDs dos estoques são filtrados para incluir apenas os do tenant atual
      const estoquesIds = estoques?.map(e => e.id) || [];
      return (data as AlertaEstoqueFralda[]).filter(a => estoquesIds.includes(a.estoque_id));
    },
    enabled: !!tenantId && !!estoques,
  });

  // Buscar configurações de alertas filtrado por tenant
  const { data: configuracoes } = useQuery({
    queryKey: ["configuracoes-alertas-fraldas", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from("configuracoes_alertas_fraldas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ConfiguracaoAlertasFraldas | null;
    },
    enabled: !!tenantId,
  });

  // Criar estoque
  const criarEstoque = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) {
        throw new Error("Tenant não identificado. Por favor, faça login novamente.");
      }
      const { data: result, error } = await supabase
        .from("estoque_fraldas")
        .insert([{ ...data, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-fraldas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["alertas-estoque-fraldas", tenantId] });
      toast.success("Estoque de fralda cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar estoque: " + error.message);
    },
  });

  // Atualizar estoque
  const atualizarEstoque = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EstoqueFralda> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("estoque_fraldas")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-fraldas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["alertas-estoque-fraldas", tenantId] });
      toast.success("Estoque atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar estoque: " + error.message);
    },
  });

  // Registrar uso de fralda
  const registrarUso = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from("uso_fraldas")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-fraldas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["alertas-estoque-fraldas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["uso-fraldas"] });
      toast.success("Uso de fralda registrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar uso: " + error.message);
    },
  });

  // Salvar configurações de alertas
  const salvarConfiguracoes = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) {
        throw new Error("Tenant não identificado. Por favor, faça login novamente.");
      }
      
      if (configuracoes?.id) {
        const { data: result, error } = await supabase
          .from("configuracoes_alertas_fraldas")
          .update(data)
          .eq("id", configuracoes.id)
          .select()
          .single();

        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from("configuracoes_alertas_fraldas")
          .insert([{ ...data, tenant_id: tenantId }])
          .select()
          .single();

        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-alertas-fraldas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["alertas-estoque-fraldas", tenantId] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  return {
    estoques,
    loadingEstoques,
    alertas,
    loadingAlertas,
    configuracoes,
    criarEstoque,
    atualizarEstoque,
    registrarUso,
    salvarConfiguracoes,
  };
};
