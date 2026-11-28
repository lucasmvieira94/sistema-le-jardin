import { useLocation, Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { useEhComite } from "@/hooks/useEhComite";
import { useSuperAdmin } from "@/hooks/saas/useSuperAdmin";
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
  Brain,
  BarChart3,
  ShieldAlert,
  AlertTriangle,
  Trophy,
  Syringe,
  CreditCard,
  Building2,
  Wallet,
  FileSignature,
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
  const ehComite = useEhComite();
  const { isSuperAdmin } = useSuperAdmin();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    window.location.href = "/auth";
  };

  const isActive = (path: string) => location.pathname === path;

  type ItemMenu = { path: string; icon: typeof Home; label: string; public?: boolean; adminOnly?: boolean; complianceOnly?: boolean };

  // Itens fixos no topo: uso diário do gestor
  const mainNavItems: ItemMenu[] = [
    { path: "/dashboard", icon: Home, label: "Dashboard" },
    { path: "/financeiro", icon: Wallet, label: "Financeiro", adminOnly: true },
  ];

  // Grupos organizados pela rotina de uso do sistema
  const gruposMenu: { titulo: string; itens: ItemMenu[] }[] = [
    { titulo: "Residentes e Cuidados", itens: [
      { path: "/residentes", icon: Users, label: "Residentes" },
      { path: "/controle-prontuarios", icon: FileText, label: "Prontuários" },
      { path: "/controle-medicamentos", icon: Pill, label: "Medicamentos" },
      { path: "/remocoes-medicamentos", icon: Pill, label: "Aprovações de Remoção" },
      { path: "/controle-fraldas", icon: Baby, label: "Fraldas" },
      { path: "/controle-temperatura", icon: Thermometer, label: "Temperatura" },
      { path: "/controle-vacinas", icon: Syringe, label: "Vacinas" },
      { path: "/gestao-intercorrencias", icon: AlertTriangle, label: "Intercorrências" },
    ]},
    { titulo: "Equipe", itens: [
      { path: "/funcionarios", icon: Users, label: "Funcionários" },
      { path: "/cargos", icon: Users, label: "Cargos e Funções" },
      { path: "/escalas", icon: Calendar, label: "Escalas" },
      { path: "/faltas", icon: FileX, label: "Afastamentos" },
      { path: "/advertencias-suspensoes", icon: ShieldAlert, label: "Advertências" },
      { path: "/analise-condutas", icon: AlertTriangle, label: "Análise de Condutas" },
      { path: "/gestao-gamificacao", icon: Trophy, label: "Gamificação" },
    ]},
    { titulo: "Ponto e Folha", itens: [
      { path: "/apropriacao", icon: Clock, label: "Apropriação de Horas" },
      { path: "/relatorios", icon: FileText, label: "Folhas de Ponto" },
      { path: "/contracheques", icon: CreditCard, label: "Contracheques" },
    ]},
    { titulo: "Documentos e Assinaturas", itens: [
      { path: "/documentos-internos", icon: FileSignature, label: "Documentos Internos" },
      { path: "/controle-assinaturas", icon: FileSignature, label: "Controle de Assinaturas" },
      { path: "/assinaturas", icon: FileSignature, label: "Assinaturas Eletrônicas" },
    ]},
    { titulo: "Comunicação e IA", itens: [
      { path: "/configuracoes-alertas", icon: Bell, label: "Alertas e Notificações" },
      { path: "/notificacoes-whatsapp", icon: MessageSquare, label: "Alertas WhatsApp" },
      { path: "/gerenciamento-whatsapp", icon: MessageSquare, label: "WhatsApp & IA" },
      { path: "/relatorios-ia", icon: Brain, label: "Relatórios com IA" },
      { path: "/analise-feedback", icon: BarChart3, label: "Análise de Feedback" },
      { path: "/rosa-orientacoes", icon: MessageSquare, label: "Rosa · Orientações" },
    ]},
    { titulo: "Administração", itens: [
      { path: "/configuracoes", icon: Settings, label: "Configurações" },
      { path: "/configuracao-formulario", icon: Settings, label: "Configurar Formulário" },
      { path: "/configuracoes/assinatura", icon: CreditCard, label: "Minha Assinatura" },
      { path: "/historico-erros", icon: AlertTriangle, label: "Histórico de Erros" },
      { path: "/canal-denuncias", icon: AlertTriangle, label: "Canal de Denúncias" },
    ]},
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
                const shouldShow = item.complianceOnly ? (user && ehComite) : (item.public || (user && (!item.adminOnly || isAdmin)));
                
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

        {/* Grupos recolhíveis: abre por padrão só o grupo da página atual */}
        {user && isAdmin && gruposMenu.map((grupo) => (
          <SidebarGroup key={grupo.titulo} className="py-0">
            <Collapsible
              defaultOpen={grupo.itens.some((i) => isActive(i.path))}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span>{grupo.titulo}</span>
                  {!isCollapsed && <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {grupo.itens.map((item) => {
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
        ))}

        {/* Plataforma SaaS - apenas super-admin */}
        {user && isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin-saas")}>
                    <Link to="/admin-saas">
                      <Building2 className="w-4 h-4" />
                      {!isCollapsed && <span>Painel SaaS</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
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