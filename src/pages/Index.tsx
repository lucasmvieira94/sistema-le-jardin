
// Dashboard de boas-vindas com cards para cada função principal

import { Link } from "react-router-dom";
import { Clock8, CalendarRange, FileBarChart2, FileCheck2 } from "lucide-react";

const cards = [
  {
    title: "Registro de Ponto",
    desc: "Marque entrada, intervalos e saída. Visualize seus registros.",
    icon: <Clock8 className="w-8 h-8 text-primary" />,
    link: "/registro",
    color: "from-green-500 to-emerald-400",
  },
  {
    title: "Gestão de Escalas",
    desc: "Crie, edite ou exclua escalas de trabalho personalizadas.",
    icon: <CalendarRange className="w-8 h-8 text-primary" />,
    link: "/escalas",
    color: "from-emerald-400 to-lime-300",
  },
  {
    title: "Relatórios Mensais",
    desc: "Gere relatórios detalhados em PDF/CSV por colaborador.",
    icon: <FileBarChart2 className="w-8 h-8 text-primary" />,
    link: "/relatorios",
    color: "from-green-400 to-green-600",
  },
  {
    title: "Faltas & Abonos",
    desc: "Registre ausências e envie comprovantes para avaliação.",
    icon: <FileCheck2 className="w-8 h-8 text-primary" />,
    link: "/faltas",
    color: "from-emerald-400 to-lime-400",
  },
];

export default function Index() {
  return (
    <section className="container mx-auto pt-8 pb-10 font-heebo">
      <h1 className="text-4xl font-bold mb-2 text-primary">Bem-vindo ao Sistema de Ponto Eletrônico!</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Controle de ponto, escalas, relatórios e gestão de colaboradores, tudo em um só lugar.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {cards.map(({ title, desc, icon, link, color }) => (
          <Link
            key={title}
            to={link}
            className={`group bg-gradient-to-br ${color} shadow-lg rounded-2xl p-6 flex flex-col gap-3 hover:scale-[1.045] hover:shadow-2xl transition duration-200 cursor-pointer`}
          >
            <div className="flex items-center mb-2">
              <span className="bg-white/90 rounded-full p-2 mr-2 group-hover:shadow-lg transition">{icon}</span>
              <span className="text-lg font-semibold text-white tracking-wide">{title}</span>
            </div>
            <p className="text-white/90 text-sm leading-snug">{desc}</p>
          </Link>
        ))}
      </div>
      <footer className="mt-20 text-center text-xs text-muted-foreground opacity-60">
        &copy; {new Date().getFullYear()} Sistema de Ponto Eletrônico. Todos os direitos reservados.
      </footer>
    </section>
  );
}
