/**
 * Helpers para queries Supabase com multi-tenancy
 * 
 * IMPORTANTE: Sempre usar estas funções ao invés de queries diretas
 * para garantir isolamento de dados por tenant
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TableName = keyof Database['public']['Tables'];

/**
 * Busca registros filtrados por tenant
 * 
 * NOTA: O RLS já garante o filtro por tenant automaticamente,
 * mas incluímos o filtro explícito como camada adicional de segurança
 */
export function selectWithTenant<T extends TableName>(
  tableName: T,
  tenantId: string
) {
  return supabase
    .from(tableName)
    .select('*')
    .eq('tenant_id' as any, tenantId);
}

/**
 * Insere registro com tenant_id automático
 */
export async function insertWithTenant<T extends TableName>(
  tableName: T,
  data: any,
  tenantId: string
) {
  return supabase
    .from(tableName)
    .insert({
      ...data,
      tenant_id: tenantId
    });
}

/**
 * Atualiza registro validando tenant_id
 */
export async function updateWithTenant<T extends TableName>(
  tableName: T,
  id: string,
  data: any,
  tenantId: string
) {
  return supabase
    .from(tableName)
    .update(data)
    .eq('id' as any, id)
    .eq('tenant_id' as any, tenantId);
}

/**
 * Deleta registro validando tenant_id
 */
export async function deleteWithTenant<T extends TableName>(
  tableName: T,
  id: string,
  tenantId: string
) {
  return supabase
    .from(tableName)
    .delete()
    .eq('id' as any, id)
    .eq('tenant_id' as any, tenantId);
}

/**
 * Valida se um registro pertence ao tenant
 */
export async function validateRecordTenant<T extends TableName>(
  tableName: T,
  recordId: string,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('id' as any, recordId)
    .eq('tenant_id' as any, tenantId)
    .single();

  return !error && !!data;
}
