import { Link, useLocation } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Button } from "@/components/ui/button";
import { Home, Users, Calendar, FileText, FileX, LogOut, User, Clock } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuthSession();

  const handleLogout = async () => {
    // Implementar logout se necessário
    window.location.href = "/auth";
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", icon: Home, label: "Registro Ponto", public: true },
    { path: "/dashboard", icon: FileText, label: "Dashboard", public: false },
    { path: "/funcionarios", icon: Users, label: "Funcionários", public: false },
    { path: "/escalas", icon: Calendar, label: "Escalas", public: false },
    { path: "/apropriacao", icon: Clock, label: "Apropriação", public: false },
    { path: "/relatorios", icon: FileText, label: "Relatórios", public: false },
    { path: "/faltas", icon: FileX, label: "Afastamentos", public: false },
  ];

  return (
    <nav className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-4">
      <div className="flex items-center space-x-6">
        <Link to="/" className="font-bold text-xl text-primary">
          SenexCare
        </Link>
        
        <div className="flex space-x-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const shouldShow = item.public || user;
            
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
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">{user.email}</span>
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
