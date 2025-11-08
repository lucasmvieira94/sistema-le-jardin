import { useLocation, Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { 
  Home, 
  Users, 
  Calendar, 
  FileText, 
  FileX, 
  LogOut, 
  User, 
  Clock, 
  Settings,
  ChevronDown,
  Pill,
  Thermometer,
  MessageSquare,
  Baby,
  Bell,
  Brain
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuthSession();
  const { isAdmin } = useUserRole();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    window.location.href = "/auth";
  };

  const isActive = (path: string) => location.pathname === path;

  // Apenas Dashboard nos itens principais (removendo Registro Ponto e Prontuário)
  const mainNavItems = [
    { path: "/dashboard", icon: Home, label: "Dashboard", public: false, adminOnly: false },
  ];

  const pontoMenuItems = [
    { path: "/funcionarios", icon: Users, label: "Funcionários", adminOnly: true },
    { path: "/escalas", icon: Calendar, label: "Escalas", adminOnly: true },
    { path: "/apropriacao", icon: Clock, label: "Apropriação", adminOnly: true },
    { path: "/relatorios", icon: FileText, label: "Relatórios", adminOnly: true },
    { path: "/faltas", icon: FileX, label: "Afastamentos", adminOnly: true },
  ];

  const sistemaMenuItems = [
    { path: "/residentes", icon: Users, label: "Residentes", adminOnly: true },
    { path: "/controle-prontuarios", icon: FileText, label: "Controle de Prontuários", adminOnly: true },
    { path: "/controle-medicamentos", icon: Pill, label: "Controle de Medicamentos", adminOnly: true },
    { path: "/controle-fraldas", icon: Baby, label: "Controle de Fraldas", adminOnly: true },
    { path: "/controle-temperatura", icon: Thermometer, label: "Controle de Temperatura", adminOnly: true },
    { path: "/gerenciamento-whatsapp", icon: MessageSquare, label: "WhatsApp & IA", adminOnly: true },
    { path: "/notificacoes-whatsapp", icon: MessageSquare, label: "Alertas WhatsApp", adminOnly: true },
    { path: "/configuracao-formulario", icon: Settings, label: "Configurar Formulário", adminOnly: true },
    { path: "/relatorios-ia", icon: Brain, label: "Relatórios com IA", adminOnly: true },
    { path: "/configuracoes-alertas", icon: Bell, label: "Alertas e Notificações", adminOnly: true },
    { path: "/configuracoes", icon: Settings, label: "Configurações", adminOnly: true },
  ];

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-60"}>
      <SidebarContent>
        {/* Branding and Tenant Switcher */}
        <div className={`p-4 border-b space-y-3 ${isCollapsed ? 'text-center' : ''}`}>
          <h1 className={`font-bold text-primary ${isCollapsed ? 'text-sm' : 'text-xl'}`}>
            {isCollapsed ? 'SC' : 'SenexCare'}
          </h1>
          {!isCollapsed && (
            <div className="flex justify-center">
              <TenantSwitcher />
            </div>
          )}
        </div>

        {/* User Info */}
        {user && (
          <div className={`p-4 border-b ${isCollapsed ? 'hidden' : 'block'}`}>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 truncate">
                  {user.email}
                </p>
                {isAdmin && (
                  <p className="text-xs text-primary">Administrador</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const shouldShow = item.public || (user && (!item.adminOnly || isAdmin));
                
                if (!shouldShow) return null;
                
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive(item.path)}>
                      <Link to={item.path}>
                        <Icon className="w-4 h-4" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Controle de Ponto - Collapsible Group */}
        {user && isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span>Controle de Ponto</span>
                  {!isCollapsed && <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {pontoMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActive(item.path)}>
                            <Link to={item.path}>
                              <Icon className="w-4 h-4" />
                              {!isCollapsed && <span>{item.label}</span>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Gestão do Sistema - Collapsible Group */}
        {user && isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span>Gestão do Sistema</span>
                  {!isCollapsed && <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sistemaMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActive(item.path)}>
                            <Link to={item.path}>
                              <Icon className="w-4 h-4" />
                              {!isCollapsed && <span>{item.label}</span>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Logout Button */}
        {user && (
          <div className="mt-auto p-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${isCollapsed ? 'w-full p-2' : 'w-full'}`}
            >
              <LogOut className="w-4 h-4" />
              {!isCollapsed && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}