import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegistroTemperatura {
  id: string;
  data_registro: string;
  horario_medicao: string;
  temperatura: number;
  periodo_dia: string;
  conformidade: boolean;
  acoes_corretivas?: string;
  funcionario_responsavel?: string;
  nome_responsavel: string;
  localizacao_sala: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

interface EstatisticasTemperatura {
  registrosHoje: number;
  percentualConformidade: number;
  registrosNaoConformes: number;
  ultimaMedicao?: string;
  temperaturaMedia?: number;
}

interface NovoRegistroTemperatura {
  temperatura: number;
  periodo_dia: string;
  horario_medicao: string;
  nome_responsavel: string;
  funcionario_responsavel?: string;
  localizacao_sala?: string;
  acoes_corretivas?: string;
  observacoes?: string;
}

export function useTemperatura() {
  const queryClient = useQueryClient();

  // Buscar registros de temperatura
  const { data: registrosTemperatura = [], isLoading } = useQuery({
    queryKey: ['registros-temperatura'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_temperatura_medicamentos')
        .select('*')
        .order('data_registro', { ascending: false })
        .order('horario_medicao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar registros de temperatura:', error);
        throw error;
      }

      return data as RegistroTemperatura[];
    },
  });

  // Calcular estatísticas
  const { data: estatisticas } = useQuery({
    queryKey: ['estatisticas-temperatura', registrosTemperatura],
    queryFn: async (): Promise<EstatisticasTemperatura> => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const registrosHoje = registrosTemperatura.filter(
        registro => registro.data_registro === hoje
      );
      
      const totalRegistros = registrosTemperatura.length;
      const registrosConformes = registrosTemperatura.filter(r => r.conformidade).length;
      const registrosNaoConformes = totalRegistros - registrosConformes;
      
      const percentualConformidade = totalRegistros > 0 
        ? Math.round((registrosConformes / totalRegistros) * 100)
        : 100;

      const ultimaMedicao = registrosTemperatura.length > 0 
        ? `${registrosTemperatura[0].data_registro}T${registrosTemperatura[0].horario_medicao}`
        : undefined;

      const temperaturaMedia = registrosTemperatura.length > 0
        ? registrosTemperatura.reduce((sum, r) => sum + r.temperatura, 0) / registrosTemperatura.length
        : undefined;

      return {
        registrosHoje: registrosHoje.length,
        percentualConformidade,
        registrosNaoConformes,
        ultimaMedicao,
        temperaturaMedia
      };
    },
    enabled: registrosTemperatura.length > 0,
  });

  // Mutation para cadastrar novo registro
  const adicionarRegistro = useMutation({
    mutationFn: async (novoRegistro: NovoRegistroTemperatura) => {
      const { data, error } = await supabase
        .from('controle_temperatura_medicamentos')
        .insert({
          ...novoRegistro,
          data_registro: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao adicionar registro:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-temperatura'] });
      toast.success('Registro de temperatura adicionado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao adicionar registro:', error);
      toast.error('Erro ao adicionar registro de temperatura');
    },
  });

  // Buscar registros por período
  const buscarRegistrosPorPeriodo = async (dataInicio: string, dataFim: string) => {
    const { data, error } = await supabase
      .from('controle_temperatura_medicamentos')
      .select('*')
      .gte('data_registro', dataInicio)
      .lte('data_registro', dataFim)
      .order('data_registro', { ascending: true })
      .order('horario_medicao', { ascending: true });

    if (error) {
      console.error('Erro ao buscar registros por período:', error);
      throw error;
    }

    return data as RegistroTemperatura[];
  };

  return {
    registrosTemperatura,
    estatisticas,
    isLoading,
    adicionarRegistro,
    buscarRegistrosPorPeriodo
  };
}