import { Link } from "react-router-dom";
import { Users, Clock, UserX, FileHeart, Pill, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AcoesRapidas() {
  const acoes = [
    {
      titulo: "Gerenciar Funcionários",
      descricao: "Ver lista e editar funcionários",
      icon: <Users className="h-5 w-5" />,
      link: "/funcionarios",
      cor: "bg-primary/10 hover:bg-primary/20"
    },
    {
      titulo: "Apropriação",
      descricao: "Controle de horas trabalhadas",
      icon: <Clock className="h-5 w-5" />,
      link: "/apropriacao-horas",
      cor: "bg-accent/10 hover:bg-accent/20"
    },
    {
      titulo: "Afastamentos",
      descricao: "Gerenciar faltas e licenças",
      icon: <UserX className="h-5 w-5" />,
      link: "/faltas",
      cor: "bg-secondary/10 hover:bg-secondary/20"
    },
    {
      titulo: "Controle de Prontuários",
      descricao: "Gerenciar prontuários médicos",
      icon: <FileHeart className="h-5 w-5" />,
      link: "/prontuario",
      cor: "bg-muted/10 hover:bg-muted/20"
    },
    {
      titulo: "Controle Medicamentos",
      descricao: "Gestão de medicamentos",
      icon: <Pill className="h-5 w-5" />,
      link: "/controle-medicamentos",
      cor: "bg-primary/10 hover:bg-primary/20"
    },
    {
      titulo: "Configurar Formulário",
      descricao: "Personalizar formulários",
      icon: <Settings className="h-5 w-5" />,
      link: "/configuracao-formulario",
      cor: "bg-accent/10 hover:bg-accent/20"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {acoes.map((acao, index) => (
            <Link key={index} to={acao.link}>
              <Button 
                variant="ghost" 
                className={`h-auto p-4 flex flex-col items-center gap-2 text-center w-full ${acao.cor}`}
              >
                <div className="text-primary">
                  {acao.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{acao.titulo}</p>
                  <p className="text-xs text-muted-foreground">{acao.descricao}</p>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}