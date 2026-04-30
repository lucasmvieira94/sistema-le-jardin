import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

export type ModuloKey =
  | 'ponto' | 'escala' | 'prontuario' | 'residentes'
  | 'medicamentos' | 'fraldas' | 'intercorrencias' | 'advertencias'
  | 'vacinas' | 'contratos' | 'temperatura' | 'gamificacao'
  | 'whatsapp' | 'ia' | 'relatorios_ia';

export const MODULOS_DISPONIVEIS: { key: ModuloKey; nome: string; descricao: string }[] = [
  { key: 'ponto', nome: 'Registro de Ponto', descricao: 'Controle de jornada com geofence' },
  { key: 'escala', nome: 'Escalas', descricao: 'Gestão de escalas e jornadas' },
  { key: 'prontuario', nome: 'Prontuários', descricao: 'Prontuários eletrônicos com ciclos' },
  { key: 'residentes', nome: 'Residentes', descricao: 'Cadastro completo de residentes' },
  { key: 'medicamentos', nome: 'Medicamentos', descricao: 'Catálogo, prescrição e administração' },
  { key: 'fraldas', nome: 'Controle de Fraldas', descricao: 'Estoque e uso individualizado' },
  { key: 'intercorrencias', nome: 'Intercorrências', descricao: 'Registro e gestão de ocorrências' },
  { key: 'advertencias', nome: 'Advertências/Suspensões', descricao: 'Medidas disciplinares CLT' },
  { key: 'vacinas', nome: 'Cartão Vacinal', descricao: 'Histórico vacinal dos residentes' },
  { key: 'contratos', nome: 'Contratos', descricao: 'Geração de contratos de residentes' },
  { key: 'temperatura', nome: 'Temperatura', descricao: 'Controle de temperatura de medicamentos' },
  { key: 'gamificacao', nome: 'Gamificação', descricao: 'XP, moedas e prêmios para colaboradores' },
  { key: 'whatsapp', nome: 'WhatsApp', descricao: 'Notificações e alertas via WhatsApp' },
  { key: 'ia', nome: 'Assistentes IA', descricao: 'Assistentes de IA (RH, supervisora, prontuário)' },
  { key: 'relatorios_ia', nome: 'Relatórios IA', descricao: 'Análises automáticas semanais por IA' },
];

/**
 * Hook que retorna os módulos habilitados para o tenant atual
 * e função para verificar se um módulo específico está habilitado.
 */
export function useTenantModulos() {
  const { tenantId } = useTenantContext();

  const { data: modulos = {}, isLoading } = useQuery({
    queryKey: ['tenant-modulos', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // módulos mudam raramente
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_modulos')
        .select('modulo, habilitado')
        .eq('tenant_id', tenantId!);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((m: any) => {
        map[m.modulo] = !!m.habilitado;
      });
      return map;
    },
  });

  const isHabilitado = (key: ModuloKey) => modulos[key] === true;

  return { modulos, isHabilitado, loading: !!tenantId && isLoading };
}