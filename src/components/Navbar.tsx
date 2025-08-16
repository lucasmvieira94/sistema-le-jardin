import { Link, useLocation } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
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
  FileHeart,
  ChevronDown
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuthSession();
  const { isAdmin, role } = useUserRole();

  const handleLogout = async () => {
    // Implementar logout se necessário
    window.location.href = "/auth";
  };

  const isActive = (path: string) => location.pathname === path;

  const mainNavItems = [
    { path: "/", icon: Home, label: "Registro Ponto", public: true, adminOnly: false },
    { path: "/dashboard", icon: FileText, label: "Dashboard", public: false, adminOnly: false },
    { path: "/prontuario", icon: FileHeart, label: "Prontuário", public: true, adminOnly: false },
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
    { path: "/configuracao-formulario", icon: Settings, label: "Configurar Formulário", adminOnly: true },
    { path: "/configuracoes", icon: Settings, label: "Configurações", adminOnly: true },
  ];

  return (
    <nav className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-4">
      <div className="flex items-center space-x-6">
        <Link to="/" className="font-bold text-xl text-primary">
          SenexCare
        </Link>
        
        <div className="flex space-x-1">
          {/* Itens principais da navegação */}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const shouldShow = item.public || (user && (!item.adminOnly || isAdmin));
            
            if (!shouldShow) return null;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:text-primary hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Menu Controle de Ponto */}
          {user && isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:bg-gray-100"
                >
                  <Clock className="w-4 h-4" />
                  <span>Controle de Ponto</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-white border shadow-lg">
                <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase">
                  Gestão de Ponto
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pontoMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center space-x-2 px-2 py-2 text-sm cursor-pointer ${
                          isActive(item.path) ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Menu Gestão */}
          {user && isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:bg-gray-100"
                >
                  <Settings className="w-4 h-4" />
                  <span>Gestão</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-white border shadow-lg">
                <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase">
                  Gestão do Sistema
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sistemaMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center space-x-2 px-2 py-2 text-sm cursor-pointer ${
                          isActive(item.path) ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">
              {user.email} {role && `(${role})`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sair
            </Button>
          </div>
        ) : (
          <Link to="/auth">
            <Button variant="outline" size="sm">
              Entrar
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
