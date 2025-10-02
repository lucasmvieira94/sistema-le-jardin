import { Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

/**
 * TenantSwitcher - Componente que exibe o tenant atual e permite trocar
 */
export function TenantSwitcher() {
  const { tenantName, clearTenant } = useTenant();
  const { toast } = useToast();

  const handleSwitchTenant = () => {
    clearTenant();
    toast({
      title: 'Empresa desconectada',
      description: 'Selecione uma empresa para continuar',
    });
    // O TenantGuard vai automaticamente mostrar o seletor
  };

  if (!tenantName) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">{tenantName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Empresa Atual</p>
            <p className="text-xs text-muted-foreground">{tenantName}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSwitchTenant} className="text-destructive cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Trocar Empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
