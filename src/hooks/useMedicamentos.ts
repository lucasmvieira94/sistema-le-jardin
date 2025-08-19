import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Medicamento {
  id: string;
  nome: string;
  principio_ativo?: string;
  dosagem?: string;
  forma_farmaceutica?: string;
  fabricante?: string;
  codigo_barras?: string;
  concentracao?: string;
  unidade_medida: string;
  prescricao_obrigatoria: boolean;
  controlado: boolean;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EstoqueMedicamento {
  id: string;
  medicamento_id: string;
  lote?: string;
  data_validade?: string;
  quantidade_atual: number;
  quantidade_minima: number;
  quantidade_maxima: number;
  preco_unitario?: number;
  fornecedor?: string;
  data_entrada: string;
  observacoes?: string;
  ativo: boolean;
  medicamento?: Medicamento;
}

export interface ResidenteMedicamento {
  id: string;
  residente_id: string;
  medicamento_id: string;
  dosagem_prescrita: string;
  frequencia: string;
  horarios?: string[];
  via_administracao?: string;
  observacoes?: string;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  prescrito_por?: string;
  medicamento?: Medicamento;
}

export const useMedicamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todos os medicamentos
  const medicamentos = useQuery({
    queryKey: ["medicamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicamentos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Medicamento[];
    },
  });

  // Buscar estoque com medicamentos
  const estoqueMedicamentos = useQuery({
    queryKey: ["estoque-medicamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_medicamentos")
        .select(`
          *,
          medicamento:medicamentos(*)
        `)
        .eq("ativo", true)
        .order("medicamento(nome)");

      if (error) throw error;
      return data as EstoqueMedicamento[];
    },
  });

  // Buscar medicamentos com estoque baixo
  const medicamentosEstoqueBaixo = useQuery({
    queryKey: ["medicamentos-estoque-baixo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_medicamentos_estoque_baixo");
      if (error) throw error;
      return data;
    },
  });

  // Cadastrar novo medicamento
  const cadastrarMedicamento = useMutation({
    mutationFn: async (medicamento: Omit<Medicamento, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("medicamentos")
        .insert([medicamento])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      toast({
        title: "Sucesso",
        description: "Medicamento cadastrado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar medicamento: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Adicionar entrada ao estoque
  const adicionarEstoque = useMutation({
    mutationFn: async (entrada: {
      medicamento_id: string;
      lote?: string;
      data_validade?: string;
      quantidade: number;
      quantidade_minima?: number;
      quantidade_maxima?: number;
      preco_unitario?: number;
      fornecedor?: string;
      observacoes?: string;
    }) => {
      // Primeiro criar o registro de estoque
      const { data: estoque, error: estoqueError } = await supabase
        .from("estoque_medicamentos")
        .insert([{
          medicamento_id: entrada.medicamento_id,
          lote: entrada.lote,
          data_validade: entrada.data_validade,
          quantidade_atual: entrada.quantidade,
          quantidade_minima: entrada.quantidade_minima || 10,
          quantidade_maxima: entrada.quantidade_maxima || 1000,
          preco_unitario: entrada.preco_unitario,
          fornecedor: entrada.fornecedor,
          observacoes: entrada.observacoes,
        }])
        .select()
        .single();

      if (estoqueError) throw estoqueError;

      // Depois registrar a entrada
      const { data: entradaData, error: entradaError } = await supabase
        .from("entrada_medicamentos")
        .insert([{
          medicamento_id: entrada.medicamento_id,
          estoque_medicamento_id: estoque.id,
          quantidade: entrada.quantidade,
          preco_unitario: entrada.preco_unitario,
          preco_total: entrada.preco_unitario ? entrada.preco_unitario * entrada.quantidade : null,
          fornecedor: entrada.fornecedor,
        }]);

      if (entradaError) throw entradaError;
      
      return estoque;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-medicamentos"] });
      queryClient.invalidateQueries({ queryKey: ["medicamentos-estoque-baixo"] });
      toast({
        title: "Sucesso",
        description: "Entrada de estoque registrada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao registrar entrada: " + error.message,
        variant: "destructive",
      });
    },
  });

  return {
    medicamentos: medicamentos.data || [],
    isLoadingMedicamentos: medicamentos.isLoading,
    estoqueMedicamentos: estoqueMedicamentos.data || [],
    isLoadingEstoque: estoqueMedicamentos.isLoading,
    medicamentosEstoqueBaixo: medicamentosEstoqueBaixo.data || [],
    isLoadingEstoqueBaixo: medicamentosEstoqueBaixo.isLoading,
    cadastrarMedicamento,
    adicionarEstoque,
  };
};