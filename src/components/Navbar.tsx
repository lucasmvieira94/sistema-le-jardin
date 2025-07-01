
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BadgeCheck, CalendarRange, Clock8, FileBarChart2, FileCheck2, Users } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { LogOut, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", label: "Registro de Ponto", icon: Clock8, requiresAuth: false },
  { to: "/dashboard", label: "Dashboard", icon: BadgeCheck, requiresAuth: true },
  { to: "/funcionarios", label: "Funcionários", icon: Users, requiresAuth: true },
  { to: "/escalas", label: "Escalas", icon: CalendarRange, requiresAuth: true },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2, requiresAuth: true },
  { to: "/faltas", label: "Faltas & Abonos", icon: FileCheck2, requiresAuth: true },
];

export default function Navbar() {
  const { user } = useAuthSession();
  const { pathname } = useLocation();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (!error) window.location.href = "/";
  }

  return (
    <nav className="bg-primary text-primary-foreground shadow-md font-heebo">
      <div className="container mx-auto flex items-center justify-between py-2 px-4">
        <div className="flex items-center gap-3 font-bold text-2xl tracking-wide">
          <span className="inline-block bg-emerald-600 w-9 h-9 rounded-full flex items-center justify-center mr-2">
            <Clock8 className="text-white w-5 h-5" />
          </span>
          Sistema de Ponto Eletrônico
        </div>
        <ul className="flex items-center gap-2 text-base">
          {navItems.map(({ to, label, icon: Icon, requiresAuth }) => {
            // Mostrar item se não requer auth ou se o usuário está logado
            if (requiresAuth && !user) return null;
            
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={
                    "flex items-center gap-1 px-3 py-2 rounded-md transition-colors " +
                    (pathname === to
                      ? "bg-emerald-700 text-white shadow"
                      : "hover:bg-accent hover:text-primary")
                  }
                >
                  <Icon className="w-5 h-5 mr-1" />
                  {label}
                </Link>
              </li>
            );
          })}
          {/* Botão Login/Logout à direita */}
          {user ? (
            <li>
              <button
                className="flex items-center gap-1 px-3 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary"
                onClick={handleLogout}
                title="Sair"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Sair
              </button>
            </li>
          ) : (
            <li>
              <Link
                to="/auth"
                className="flex items-center gap-1 px-3 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary"
                title="Entrar"
              >
                <LogIn className="w-5 h-5 mr-1" />
                Entrar
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
