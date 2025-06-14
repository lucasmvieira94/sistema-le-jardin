
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BadgeCheck, CalendarRange, Clock8, FileBarChart2, FileCheck2 } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: BadgeCheck },
  { to: "/registro", label: "Registro de Ponto", icon: Clock8 },
  { to: "/escalas", label: "Escalas", icon: CalendarRange },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
  { to: "/faltas", label: "Faltas & Abonos", icon: FileCheck2 },
];

export default function Navbar() {
  const { pathname } = useLocation();

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
          {navItems.map(({ to, label, icon: Icon }) => (
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
          ))}
        </ul>
      </div>
    </nav>
  );
}
