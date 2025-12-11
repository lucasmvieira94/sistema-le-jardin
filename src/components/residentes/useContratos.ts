import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Contrato {
  id: string;
  residente_id: string;
  numero_contrato: string;
  valor_mensalidade: number;
  dia_vencimento: number;
  forma_pagamento: string;
  data_inicio_contrato: string;
  data_fim_contrato: string | null;
  contratante_nome: string;
  contratante_cpf: string | null;
  contratante_rg: string | null;
  contratante_endereco: string | null;
  contratante_cidade: string | null;
  contratante_estado: string | null;
  contratante_cep: string | null;
  contratante_telefone: string | null;
  contratante_email: string | null;
  servicos_inclusos: string[] | null;
  servicos_adicionais: string | null;
  clausulas_especiais: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ContratoFormData {
  valor_mensalidade: string;
  dia_vencimento: string;
  forma_pagamento: string;
  data_inicio_contrato: string;
  data_fim_contrato: string;
  contratante_nome: string;
  contratante_cpf: string;
  contratante_rg: string;
  contratante_endereco: string;
  contratante_cidade: string;
  contratante_estado: string;
  contratante_cep: string;
  contratante_telefone: string;
  contratante_email: string;
  servicos_inclusos: string[];
  servicos_adicionais: string;
  clausulas_especiais: string;
  observacoes: string;
}

export function useContratos() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContratos = useCallback(async (residenteId?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('contratos_residentes')
        .select('*')
        .order('created_at', { ascending: false });

      if (residenteId) {
        query = query.eq('residente_id', residenteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContratos(data || []);
    } catch (error) {
      console.error('Erro ao buscar contratos:', error);
      toast({
        title: "Erro ao carregar contratos",
        description: "Não foi possível carregar os contratos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const gerarNumeroContrato = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('contratos_residentes')
        .select('numero_contrato')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const anoAtual = new Date().getFullYear();
      let proximoNumero = 1;

      if (data && data.length > 0) {
        const ultimoContrato = data[0].numero_contrato;
        const match = ultimoContrato.match(/(\d+)\/(\d+)/);
        if (match) {
          const ano = parseInt(match[2]);
          if (ano === anoAtual) {
            proximoNumero = parseInt(match[1]) + 1;
          }
        }
      }

      return `${proximoNumero.toString().padStart(4, '0')}/${anoAtual}`;
    } catch (error) {
      console.error('Erro ao gerar número do contrato:', error);
      return `0001/${new Date().getFullYear()}`;
    }
  };

  const criarContrato = async (residenteId: string, formData: ContratoFormData) => {
    try {
      const numeroContrato = await gerarNumeroContrato();

      const contratoData = {
        residente_id: residenteId,
        numero_contrato: numeroContrato,
        valor_mensalidade: parseFloat(formData.valor_mensalidade),
        dia_vencimento: parseInt(formData.dia_vencimento),
        forma_pagamento: formData.forma_pagamento,
        data_inicio_contrato: formData.data_inicio_contrato,
        data_fim_contrato: formData.data_fim_contrato || null,
        contratante_nome: formData.contratante_nome,
        contratante_cpf: formData.contratante_cpf || null,
        contratante_rg: formData.contratante_rg || null,
        contratante_endereco: formData.contratante_endereco || null,
        contratante_cidade: formData.contratante_cidade || null,
        contratante_estado: formData.contratante_estado || null,
        contratante_cep: formData.contratante_cep || null,
        contratante_telefone: formData.contratante_telefone || null,
        contratante_email: formData.contratante_email || null,
        servicos_inclusos: formData.servicos_inclusos,
        servicos_adicionais: formData.servicos_adicionais || null,
        clausulas_especiais: formData.clausulas_especiais || null,
        observacoes: formData.observacoes || null,
        status: 'ativo'
      };

      const { data, error } = await supabase
        .from('contratos_residentes')
        .insert(contratoData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Contrato criado",
        description: `Contrato nº ${numeroContrato} criado com sucesso.`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar contrato:', error);
      toast({
        title: "Erro ao criar contrato",
        description: "Não foi possível criar o contrato.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const atualizarContrato = async (contratoId: string, formData: ContratoFormData) => {
    try {
      const contratoData = {
        valor_mensalidade: parseFloat(formData.valor_mensalidade),
        dia_vencimento: parseInt(formData.dia_vencimento),
        forma_pagamento: formData.forma_pagamento,
        data_inicio_contrato: formData.data_inicio_contrato,
        data_fim_contrato: formData.data_fim_contrato || null,
        contratante_nome: formData.contratante_nome,
        contratante_cpf: formData.contratante_cpf || null,
        contratante_rg: formData.contratante_rg || null,
        contratante_endereco: formData.contratante_endereco || null,
        contratante_cidade: formData.contratante_cidade || null,
        contratante_estado: formData.contratante_estado || null,
        contratante_cep: formData.contratante_cep || null,
        contratante_telefone: formData.contratante_telefone || null,
        contratante_email: formData.contratante_email || null,
        servicos_inclusos: formData.servicos_inclusos,
        servicos_adicionais: formData.servicos_adicionais || null,
        clausulas_especiais: formData.clausulas_especiais || null,
        observacoes: formData.observacoes || null,
      };

      const { data, error } = await supabase
        .from('contratos_residentes')
        .update(contratoData)
        .eq('id', contratoId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Contrato atualizado",
        description: "O contrato foi atualizado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar contrato:', error);
      toast({
        title: "Erro ao atualizar contrato",
        description: "Não foi possível atualizar o contrato.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const alterarStatusContrato = async (contratoId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('contratos_residentes')
        .update({ status: novoStatus })
        .eq('id', contratoId);

      if (error) throw error;

      toast({
        title: "Status alterado",
        description: `Contrato ${novoStatus === 'ativo' ? 'ativado' : novoStatus === 'suspenso' ? 'suspenso' : 'encerrado'} com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do contrato.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    contratos,
    loading,
    fetchContratos,
    criarContrato,
    atualizarContrato,
    alterarStatusContrato,
  };
}
