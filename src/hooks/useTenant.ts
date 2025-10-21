import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TENANT_STORAGE_KEY = 'le_jardin_tenant';
const TENANT_EXPIRY_KEY = 'le_jardin_tenant_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

interface TenantData {
  tenantId: string;
  tenantName: string;
  timestamp: number;
}

interface TenantValidationResult {
  tenant_id: string | null;
  tenant_name: string | null;
  valid: boolean;
}

export function useTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  // Carregar tenant do cache ao iniciar
  useEffect(() => {
    const loadCachedTenant = () => {
      try {
        const cachedData = localStorage.getItem(TENANT_STORAGE_KEY);
        const expiryStr = localStorage.getItem(TENANT_EXPIRY_KEY);
        
        if (cachedData && expiryStr) {
          const expiry = parseInt(expiryStr, 10);
          const now = Date.now();
          
          // Verificar se cache expirou
          if (now < expiry) {
            const data: TenantData = JSON.parse(cachedData);
            setTenantId(data.tenantId);
            setTenantName(data.tenantName);
          } else {
            // Cache expirado, limpar
            clearTenant();
          }
        }
      } catch (error) {
        console.error('Erro ao carregar tenant do cache:', error);
        clearTenant();
      } finally {
        setLoading(false);
      }
    };

    loadCachedTenant();
  }, []);

  // Validar employer_code
  const validateEmployerCode = useCallback(async (employerCode: string): Promise<{
    success: boolean;
    tenantId?: string;
    tenantName?: string;
    error?: string;
  }> => {
    if (!employerCode?.trim()) {
      return { success: false, error: 'Código da empresa é obrigatório' };
    }

    setValidating(true);
    
    try {
      const { data, error } = await supabase
        .rpc('validate_employer_code', {
          p_employer_code: employerCode.trim().toUpperCase()
        })
        .single();

      if (error) {
        console.error('Erro ao validar código:', error);
        return { success: false, error: 'Erro ao validar código da empresa' };
      }

      const result = data as TenantValidationResult;

      if (!result.valid || !result.tenant_id) {
        return { success: false, error: 'Código da empresa inválido ou inativo' };
      }

      // Salvar no cache
      const tenantData: TenantData = {
        tenantId: result.tenant_id,
        tenantName: result.tenant_name || 'Empresa',
        timestamp: Date.now()
      };

      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenantData));
      localStorage.setItem(TENANT_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());

      // Atualizar estado
      setTenantId(result.tenant_id);
      setTenantName(result.tenant_name || 'Empresa');

      return { 
        success: true, 
        tenantId: result.tenant_id,
        tenantName: result.tenant_name || 'Empresa'
      };
    } catch (error) {
      console.error('Erro inesperado ao validar código:', error);
      return { success: false, error: 'Erro inesperado ao validar código' };
    } finally {
      setValidating(false);
    }
  }, []);

  // Limpar tenant (logout de empresa)
  const clearTenant = useCallback(() => {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    localStorage.removeItem(TENANT_EXPIRY_KEY);
    setTenantId(null);
    setTenantName(null);
  }, []);

  // Buscar e definir tenant automaticamente pelo user_id
  const setTenantByUserId = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Buscar tenant_id do usuário na tabela user_roles
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          tenant_id,
          tenants:tenant_id (
            nome
          )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar tenant do usuário:', error);
        return false;
      }

      if (!data || !data.tenant_id) {
        console.error('Usuário não está associado a nenhuma empresa');
        return false;
      }

      // Extrair nome do tenant
      const tenants = data.tenants as any;
      const tenantName = tenants?.nome || 'Empresa';

      // Salvar no cache
      const tenantData: TenantData = {
        tenantId: data.tenant_id,
        tenantName: tenantName,
        timestamp: Date.now()
      };

      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenantData));
      localStorage.setItem(TENANT_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());

      // Atualizar estado
      setTenantId(data.tenant_id);
      setTenantName(tenantName);

      return true;
    } catch (error) {
      console.error('Erro ao definir tenant pelo usuário:', error);
      return false;
    }
  }, []);

  // Verificar se tenant ainda é válido
  const revalidateTenant = useCallback(async (): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nome, ativo')
        .eq('id', tenantId)
        .single();

      if (error || !data || !data.ativo) {
        clearTenant();
        return false;
      }

      // Atualizar nome se mudou
      if (data.nome !== tenantName) {
        setTenantName(data.nome);
        const cachedData = localStorage.getItem(TENANT_STORAGE_KEY);
        if (cachedData) {
          const tenantData: TenantData = JSON.parse(cachedData);
          tenantData.tenantName = data.nome;
          localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenantData));
        }
      }

      return true;
    } catch (error) {
      console.error('Erro ao revalidar tenant:', error);
      return false;
    }
  }, [tenantId, tenantName, clearTenant]);

  return {
    tenantId,
    tenantName,
    loading,
    validating,
    isAuthenticated: !!tenantId,
    validateEmployerCode,
    clearTenant,
    revalidateTenant,
    setTenantByUserId
  };
}
