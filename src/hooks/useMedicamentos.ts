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
  residente_id?: string;
  tipo_estoque: string;
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
  residente?: { id: string; nome: string };
}

export interface PrescricaoMedicamento {
  id: string;
  residente_id: string;
  medicamento_id: string;
  dosagem: string;
  frequencia_tipo: string;
  frequencia_valor?: number;
  horarios?: string[];
  dia_semana?: number;
  intervalo_dias?: number;
  via_administracao?: string;
  prescrito_por?: string;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  medicamento?: Medicamento;
  residente?: { id: string; nome: string };
}

export const useMedicamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Catálogo de medicamentos
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

  // Estoque por residente
  const estoqueResidentes = useQuery({
    queryKey: ["estoque-medicamentos-residentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_medicamentos")
        .select(`*, medicamento:medicamentos(*), residente:residentes(id, nome_completo)`)
        .eq("ativo", true)
        .eq("tipo_estoque", "residente")
        .not("residente_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        residente: d.residente ? { id: d.residente.id, nome: d.residente.nome_completo } : undefined,
      })) as EstoqueMedicamento[];
    },
  });

  // Estoque de urgência
  const estoqueUrgencia = useQuery({
    queryKey: ["estoque-medicamentos-urgencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_medicamentos")
        .select(`*, medicamento:medicamentos(*)`)
        .eq("ativo", true)
        .eq("tipo_estoque", "urgencia")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EstoqueMedicamento[];
    },
  });

  // Prescrições ativas
  const prescricoes = useQuery({
    queryKey: ["prescricoes-medicamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescricoes_medicamentos")
        .select(`*, medicamento:medicamentos(*), residente:residentes(id, nome_completo)`)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        residente: d.residente ? { id: d.residente.id, nome: d.residente.nome_completo } : undefined,
      })) as PrescricaoMedicamento[];
    },
  });

  // Alertas de estoque baixo
  const medicamentosEstoqueBaixo = useQuery({
    queryKey: ["medicamentos-estoque-baixo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_medicamentos_estoque_baixo");
      if (error) throw error;
      return data;
    },
  });

  // Residentes para seleção
  const residentes = useQuery({
    queryKey: ["residentes-medicamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residentes")
        .select("id, nome_completo")
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return (data || []).map(d => ({ id: d.id, nome: d.nome_completo })) as { id: string; nome: string }[];
    },
  });

  // Cadastrar medicamento no catálogo
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
      toast({ title: "Sucesso", description: "Medicamento cadastrado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao cadastrar: " + error.message, variant: "destructive" });
    },
  });

  // Adicionar entrada ao estoque (residente ou urgência)
  const adicionarEstoque = useMutation({
    mutationFn: async (entrada: {
      medicamento_id: string;
      residente_id?: string;
      tipo_estoque: string;
      lote?: string;
      data_validade?: string;
      quantidade: number;
      quantidade_minima?: number;
      quantidade_maxima?: number;
      preco_unitario?: number;
      fornecedor?: string;
      observacoes?: string;
    }) => {
      // Verificar se já existe estoque deste medicamento para este residente/urgência
      let query = supabase
        .from("estoque_medicamentos")
        .select("id, quantidade_atual")
        .eq("medicamento_id", entrada.medicamento_id)
        .eq("tipo_estoque", entrada.tipo_estoque)
        .eq("ativo", true);

      if (entrada.residente_id) {
        query = query.eq("residente_id", entrada.residente_id);
      } else {
        query = query.is("residente_id", null);
      }

      const { data: existente } = await query.maybeSingle();

      let estoqueId: string;

      if (existente) {
        // Atualizar quantidade existente
        const { error: updateError } = await supabase
          .from("estoque_medicamentos")
          .update({
            quantidade_atual: existente.quantidade_atual + entrada.quantidade,
            lote: entrada.lote || undefined,
            data_validade: entrada.data_validade || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existente.id);
        if (updateError) throw updateError;
        estoqueId = existente.id;
      } else {
        // Criar novo registro de estoque
        const { data: estoque, error: estoqueError } = await supabase
          .from("estoque_medicamentos")
          .insert([{
            medicamento_id: entrada.medicamento_id,
            residente_id: entrada.residente_id || null,
            tipo_estoque: entrada.tipo_estoque,
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
        estoqueId = estoque.id;
      }

      // Registrar entrada
      const { error: entradaError } = await supabase
        .from("entrada_medicamentos")
        .insert([{
          medicamento_id: entrada.medicamento_id,
          estoque_medicamento_id: estoqueId,
          residente_id: entrada.residente_id || null,
          tipo_estoque: entrada.tipo_estoque,
          quantidade: entrada.quantidade,
          preco_unitario: entrada.preco_unitario,
          preco_total: entrada.preco_unitario ? entrada.preco_unitario * entrada.quantidade : null,
          fornecedor: entrada.fornecedor,
        }]);
      if (entradaError) throw entradaError;

      return estoqueId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-medicamentos-residentes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-medicamentos-urgencia"] });
      queryClient.invalidateQueries({ queryKey: ["medicamentos-estoque-baixo"] });
      toast({ title: "Sucesso", description: "Entrada de estoque registrada!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao registrar entrada: " + error.message, variant: "destructive" });
    },
  });

  // Cadastrar prescrição
  const cadastrarPrescricao = useMutation({
    mutationFn: async (prescricao: {
      residente_id: string;
      medicamento_id: string;
      dosagem: string;
      frequencia_tipo: string;
      frequencia_valor?: number;
      horarios?: string[];
      dia_semana?: number;
      intervalo_dias?: number;
      via_administracao?: string;
      prescrito_por?: string;
      data_inicio: string;
      data_fim?: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from("prescricoes_medicamentos")
        .insert([prescricao])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescricoes-medicamentos"] });
      toast({ title: "Sucesso", description: "Prescrição cadastrada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: "Erro ao cadastrar prescrição: " + error.message, variant: "destructive" });
    },
  });

  return {
    medicamentos: medicamentos.data || [],
    isLoadingMedicamentos: medicamentos.isLoading,
    estoqueResidentes: estoqueResidentes.data || [],
    isLoadingEstoqueResidentes: estoqueResidentes.isLoading,
    estoqueUrgencia: estoqueUrgencia.data || [],
    isLoadingEstoqueUrgencia: estoqueUrgencia.isLoading,
    prescricoes: prescricoes.data || [],
    isLoadingPrescricoes: prescricoes.isLoading,
    medicamentosEstoqueBaixo: medicamentosEstoqueBaixo.data || [],
    isLoadingEstoqueBaixo: medicamentosEstoqueBaixo.isLoading,
    residentes: residentes.data || [],
    cadastrarMedicamento,
    adicionarEstoque,
    cadastrarPrescricao,
  };
};
