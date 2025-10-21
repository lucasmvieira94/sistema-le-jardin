import { createContext, useContext, ReactNode } from 'react';
import { useTenant } from '@/hooks/useTenant';

interface TenantContextType {
  tenantId: string | null;
  tenantName: string | null;
  loading: boolean;
  validating: boolean;
  isAuthenticated: boolean;
  validateEmployerCode: (code: string) => Promise<{
    success: boolean;
    tenantId?: string;
    tenantName?: string;
    error?: string;
  }>;
  clearTenant: () => void;
  revalidateTenant: () => Promise<boolean>;
  setTenantByUserId: (userId: string) => Promise<boolean>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenant = useTenant();

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}
